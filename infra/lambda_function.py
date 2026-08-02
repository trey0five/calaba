"""
CAL-ABA site API — single-file Lambda (python3.12, no external deps).

Datastore is plain JSON objects in S3. Auth is email + password (PBKDF2-SHA256)
issuing standard 3-segment HS256 JWTs. Public write routes are spam-gated.
Notification email goes out via SES *after* the record is durably stored, and a
SES failure is logged and swallowed so a submission is never lost.
"""

import base64
import binascii
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from urllib.parse import unquote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
S3_BUCKET = os.environ.get('S3_BUCKET', 'calabatherapy-site')
JWT_SECRET = os.environ.get('JWT_SECRET', '')
SES_FROM = os.environ.get('SES_FROM', 'noreply@calabatherapy.com')
NOTIFY_EMAIL = os.environ.get('NOTIFY_EMAIL', 'admin@calabatherapy.com')
SITE_URL = os.environ.get('SITE_URL', 'https://calabatherapy.com').rstrip('/')

ADMIN_URL = f'{SITE_URL}/#/admin'
LOGO_URL = f'{SITE_URL}/calaba2.png'

TOKEN_TTL = 12 * 3600           # 12h
PBKDF2_ITERATIONS = 210_000
LOCKOUT_MAX_FAILURES = 5        # per (ip, email)
LOCKOUT_MAX_FAILURES_EMAIL = 15  # per email, any IP (blocks distributed guessing)
LOCKOUT_WINDOW = 15 * 60
LOCKOUT_DURATION = 15 * 60

MAX_JSON_BODY = 64 * 1024       # 64KB (photo route exempt)
MAX_PHOTO_BYTES = 2 * 1024 * 1024
MAX_RESUME_BYTES = 5 * 1024 * 1024
RESUME_LINK_TTL = 300           # presigned résumé GET — short-lived by design
MAX_STRING = 500
LONG_STRINGS = {'review': 2000, 'references': 2000}

ALLOWED_ORIGINS = (
    'https://calabatherapy.com',
    'https://www.calabatherapy.com',
    'http://localhost:5175',
    'http://localhost:5173',
)

RESUME_EXTS = ('.pdf', '.doc', '.docx', '.rtf', '.txt')
# The MIME type is derived from the validated extension — the client's
# `contentType` is never trusted (it ends up pinned into a presigned POST
# policy and, later, into the Content-Type S3 serves back).
RESUME_MIME = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/octet-stream',
    '.docx': 'application/octet-stream',
    '.rtf': 'application/octet-stream',
}
PHOTO_TYPES = {'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png'}

CONTROL_CHARS = re.compile(r'[\x00-\x1f\x7f]')
EMAIL_RE = re.compile(r'^[^@\s,;:<>"\\]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}$')

REVIEW_STATUSES = ('pending', 'approved', 'rejected')
APPLICATION_STATUSES = ('new', 'reviewed', 'contacted', 'rejected')

# Keys
K_REVIEWS = 'private/data/reviews.json'
K_STAFF = 'private/data/staff.json'
K_APPLICATIONS = 'private/data/applications.json'
K_USERS = 'private/data/auth/users.json'
K_RATELIMIT = 'private/data/auth/ratelimit.json'

s3 = boto3.client('s3', config=Config(signature_version='s3v4'))
ses = boto3.client('ses')


# ──────────────────────────────────────────────────────────────
# HTTP helpers
# ──────────────────────────────────────────────────────────────
def _origin(event):
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    origin = headers.get('origin', '')
    return origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]


def respond(status, body, origin, extra_headers=None):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Vary': 'Origin',
        'Cache-Control': 'no-store',
    }
    if extra_headers:
        headers.update(extra_headers)
    return {'statusCode': status, 'headers': headers, 'body': json.dumps(body)}


def err(status, message, origin, **extra):
    payload = {'error': message}
    payload.update(extra)
    return respond(status, payload, origin)


def client_ip(event):
    ctx = event.get('requestContext') or {}
    ip = ((ctx.get('identity') or {}).get('sourceIp')) or ''
    return ip or 'unknown'


def user_agent(event):
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    return (headers.get('user-agent') or '')[:300]


def parse_body(event):
    """Returns (dict, error_string). Enforces the 64KB JSON cap."""
    raw = event.get('body') or ''
    if event.get('isBase64Encoded'):
        try:
            raw = base64.b64decode(raw).decode('utf-8')
        except Exception:
            return None, 'Malformed request body'
    if len(raw.encode('utf-8')) > MAX_JSON_BODY:
        return None, 'Request body too large'
    if not raw.strip():
        return {}, None
    try:
        data = json.loads(raw)
    except Exception:
        return None, 'Malformed JSON'
    if not isinstance(data, dict):
        return None, 'Body must be a JSON object'
    return data, None


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


# ──────────────────────────────────────────────────────────────
# S3 JSON datastore
# ──────────────────────────────────────────────────────────────
class StoreUnavailable(Exception):
    """S3 was reachable-but-broken (or write contention lost). NEVER treated as
    'the collection is empty' — the caller must fail the request with a 503
    rather than persist a truncated collection over good data."""


# Conditional writes (IfMatch / IfNoneMatch on PutObject) reached S3 in Nov 2024.
# Probe the bundled botocore once at cold start so an older Lambda runtime
# degrades to unconditional writes instead of hard-failing on every mutation.
try:
    _PUT_MEMBERS = s3.meta.service_model.operation_model('PutObject').input_shape.members
    CONDITIONAL_WRITES = 'IfMatch' in _PUT_MEMBERS and 'IfNoneMatch' in _PUT_MEMBERS
except Exception:                                                   # pragma: no cover
    CONDITIONAL_WRITES = False

_CONFLICT_CODES = ('PreconditionFailed', 'ConditionalRequestConflict', 'OperationAborted')
_MISSING_CODES = ('NoSuchKey', 'NoSuchBucket', '404')


def read_json_versioned(key, default):
    """Returns (data, etag). etag is None when the object genuinely does not
    exist yet. Raises StoreUnavailable for every other failure."""
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        data = json.loads(obj['Body'].read().decode('utf-8'))
        return data, obj.get('ETag')
    except ClientError as exc:
        code = exc.response.get('Error', {}).get('Code')
        status = (exc.response.get('ResponseMetadata') or {}).get('HTTPStatusCode')
        if code in _MISSING_CODES or status == 404:
            return default, None
        print(f'[s3] read failed key={key} code={code} err={exc}')
        raise StoreUnavailable(f'read {key}') from exc
    except StoreUnavailable:
        raise
    except Exception as exc:
        # Includes truncated bodies and corrupt JSON — anything but real absence.
        print(f'[s3] read failed key={key} err={type(exc).__name__}: {exc}')
        raise StoreUnavailable(f'read {key}') from exc


def read_json(key, default):
    return read_json_versioned(key, default)[0]


def write_json(key, data, etag=None):
    """Conditional put: IfMatch when we read a version, IfNoneMatch='*' when the
    object was absent. Raises ClientError with a conflict code if someone else
    wrote in between."""
    kwargs = {
        'Bucket': S3_BUCKET,
        'Key': key,
        'Body': json.dumps(data, indent=2).encode('utf-8'),
        'ContentType': 'application/json',
        'CacheControl': 'no-store',
        'ServerSideEncryption': 'AES256',
    }
    if CONDITIONAL_WRITES:
        if etag:
            kwargs['IfMatch'] = etag
        else:
            kwargs['IfNoneMatch'] = '*'
    s3.put_object(**kwargs)


def mutate_json(key, default, apply_fn, attempts=3):
    """Read-modify-write guarded by the object's ETag.

    `apply_fn(data)` returns `(new_data, result)`. Return `(None, result)` to
    skip the write entirely. On a 409/412 the whole read-modify-write is
    retried (up to `attempts`) so a concurrent writer never silently wins.
    """
    for attempt in range(attempts):
        data, etag = read_json_versioned(key, default)
        new_data, result = apply_fn(data)
        if new_data is None:
            return result
        try:
            write_json(key, new_data, etag)
            return result
        except ClientError as exc:
            code = exc.response.get('Error', {}).get('Code')
            status = (exc.response.get('ResponseMetadata') or {}).get('HTTPStatusCode')
            if code in _CONFLICT_CODES or status in (409, 412):
                print(f'[s3] write conflict key={key} attempt={attempt + 1}')
                time.sleep(0.08 * (attempt + 1))
                continue
            print(f'[s3] write failed key={key} code={code} err={exc}')
            raise StoreUnavailable(f'write {key}') from exc
        except Exception as exc:
            print(f'[s3] write failed key={key} err={type(exc).__name__}: {exc}')
            raise StoreUnavailable(f'write {key}') from exc
    print(f'[s3] write contention exhausted key={key}')
    raise StoreUnavailable(f'contention {key}')


def purge_object(key):
    """Delete an object AND every noncurrent version of it. The bucket is
    versioned, so a plain delete_object would leave PII readable for the 90-day
    noncurrent-version lifecycle. Best-effort: never raises."""
    if not key:
        return
    try:
        victims = []
        paginator = s3.get_paginator('list_object_versions')
        for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=key):
            for entry in (page.get('Versions') or []) + (page.get('DeleteMarkers') or []):
                if entry.get('Key') == key and entry.get('VersionId'):
                    victims.append({'Key': key, 'VersionId': entry['VersionId']})
        if not victims:
            s3.delete_object(Bucket=S3_BUCKET, Key=key)
            return
        for start in range(0, len(victims), 1000):
            s3.delete_objects(
                Bucket=S3_BUCKET,
                Delete={'Objects': victims[start:start + 1000], 'Quiet': True},
            )
        print(f'[s3] purged key={key} versions={len(victims)}')
    except Exception as exc:
        print(f'[s3] purge failed key={key} err={exc}')
        try:
            s3.delete_object(Bucket=S3_BUCKET, Key=key)
        except Exception as inner:
            print(f'[s3] fallback delete failed key={key} err={inner}')


def new_id(prefix, nbytes=4):
    return f'{prefix}_{secrets.token_hex(nbytes)}'


# ──────────────────────────────────────────────────────────────
# Passwords + JWT
# ──────────────────────────────────────────────────────────────
def hash_password(password, salt_hex=None):
    if salt_hex is None:
        salt_hex = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), bytes.fromhex(salt_hex), PBKDF2_ITERATIONS
    )
    return salt_hex, digest.hex()


def verify_password(password, salt_hex, expected_hash):
    try:
        _, actual = hash_password(password, salt_hex)
    except Exception:
        return False
    return hmac.compare_digest(actual, expected_hash or '')


def _b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _b64url_decode(text):
    pad = '=' * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def create_token(user, issued=None):
    issued = int(time.time()) if issued is None else int(issued)
    header = _b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    payload = _b64url(json.dumps({
        'sub': user['id'],
        'email': user['email'],
        'role': user.get('role', 'staff'),
        'iat': issued,
        'exp': issued + TOKEN_TTL,
    }, separators=(',', ':')).encode())
    signing_input = f'{header}.{payload}'.encode('ascii')
    signature = hmac.new(JWT_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
    # Standard order: header.payload.signature
    return f'{header}.{payload}.{_b64url(signature)}'


def verify_token(token):
    if not JWT_SECRET:
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        header = json.loads(_b64url_decode(header_b64))
        if header.get('alg') != 'HS256':
            return None
        signing_input = f'{header_b64}.{payload_b64}'.encode('ascii')
        expected = hmac.new(JWT_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(sig_b64), expected):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get('exp', 0)) <= time.time():
            return None
        return payload
    except Exception:
        return None


def authed_user(event):
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    auth = headers.get('authorization', '')
    if not auth.lower().startswith('bearer '):
        return None
    return verify_token(auth[7:].strip())


# ──────────────────────────────────────────────────────────────
# Rate limiting / lockout state (private/data/auth/ratelimit.json)
# ──────────────────────────────────────────────────────────────
def _normalize_ratelimit(state):
    if not isinstance(state, dict):
        state = {}
    if not isinstance(state.get('login'), dict):
        state['login'] = {}
    if not isinstance(state.get('windows'), dict):
        state['windows'] = {}
    return state


def _prune(state, now):
    for key, entry in list(state['login'].items()):
        fails = [t for t in entry.get('fails', []) if now - t < LOCKOUT_WINDOW]
        locked = entry.get('lockedUntil', 0)
        if not fails and locked <= now:
            state['login'].pop(key, None)
        else:
            entry['fails'] = fails
    for bucket, ips in list(state['windows'].items()):
        for ip, stamps in list(ips.items()):
            keep = [t for t in stamps if now - t < 3600]
            if keep:
                ips[ip] = keep
            else:
                ips.pop(ip, None)
        if not ips:
            state['windows'].pop(bucket, None)
    return state


def _signature(state):
    return json.dumps(state, sort_keys=True, default=str)


def _login_keys(ip, email):
    """Two independent counters: one per (ip,email) pair, and one per email so a
    distributed attacker rotating source IPs still trips a lockout."""
    return (f'{ip}|{email}', f'email|{email}')


def rate_limit_hit(bucket, ip, limit):
    """Sliding 1h window. Returns True when the caller is OVER the limit.
    State is only written when it actually changed."""
    now = time.time()

    def apply(raw):
        state = _normalize_ratelimit(raw)
        before = _signature(state)
        _prune(state, now)
        stamps = (state['windows'].get(bucket) or {}).get(ip) or []
        over = len(stamps) >= limit
        if not over:
            state['windows'].setdefault(bucket, {}).setdefault(ip, []).append(now)
        if _signature(state) == before:
            return None, over
        return state, over

    return mutate_json(K_RATELIMIT, {}, apply)


def login_locked(ip, email):
    """Seconds remaining on a lockout, or 0. Read-only — never writes."""
    now = time.time()
    state = _normalize_ratelimit(read_json(K_RATELIMIT, {}))
    remaining = 0
    for key in _login_keys(ip, email):
        entry = state['login'].get(key) or {}
        remaining = max(remaining, int((entry.get('lockedUntil') or 0) - now))
    return max(remaining, 0)


def login_failed(ip, email):
    now = time.time()
    pair_key, email_key = _login_keys(ip, email)
    caps = {pair_key: LOCKOUT_MAX_FAILURES, email_key: LOCKOUT_MAX_FAILURES_EMAIL}

    def apply(raw):
        state = _normalize_ratelimit(raw)
        _prune(state, now)
        for key, cap in caps.items():
            entry = state['login'].setdefault(key, {'fails': [], 'lockedUntil': 0})
            entry['fails'] = [t for t in entry.get('fails', []) if now - t < LOCKOUT_WINDOW]
            entry['fails'].append(now)
            if len(entry['fails']) >= cap:
                entry['lockedUntil'] = now + LOCKOUT_DURATION
                entry['fails'] = []
        return state, None

    mutate_json(K_RATELIMIT, {}, apply)


def login_succeeded(ip, email):
    """Best-effort: the caller already proved they own the account, so a store
    hiccup here must not turn a valid sign-in into a 503."""
    now = time.time()
    keys = _login_keys(ip, email)

    def apply(raw):
        state = _normalize_ratelimit(raw)
        before = _signature(state)
        _prune(state, now)
        for key in keys:
            state['login'].pop(key, None)
        if _signature(state) == before:
            return None, None
        return state, None

    try:
        mutate_json(K_RATELIMIT, {}, apply)
    except StoreUnavailable as exc:
        print(f'[login] could not clear lockout counters err={exc}')


# ──────────────────────────────────────────────────────────────
# Spam protection
# ──────────────────────────────────────────────────────────────
class SilentDrop(Exception):
    """Honeypot / timing trap tripped — respond 200 as if accepted, store nothing."""


def check_strings(body):
    """Enforce per-string length caps. Returns an error string or None."""
    for key, value in body.items():
        if isinstance(value, str):
            cap = LONG_STRINGS.get(key, MAX_STRING)
            if len(value) > cap:
                return f'Field "{key}" is too long (max {cap} characters)'
        elif isinstance(value, dict):
            nested = check_strings(value)
            if nested:
                return nested
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str) and len(item) > MAX_STRING:
                    return 'A submitted value is too long'
                if isinstance(item, dict):
                    nested = check_strings(item)
                    if nested:
                        return nested
    return None


def spam_gate(body, ip, bucket, limit):
    """Raises SilentDrop for bot traffic. Returns an error string for hard rejects."""
    if str(body.get('company', '') or '').strip():
        print(f'[spam] honeypot tripped bucket={bucket} ip={ip}')
        raise SilentDrop()

    opened = body.get('formOpenedAt')
    try:
        opened_ms = int(opened)
    except (TypeError, ValueError):
        print(f'[spam] missing formOpenedAt bucket={bucket} ip={ip}')
        raise SilentDrop()
    age = time.time() - (opened_ms / 1000.0)
    if age < 3 or age > 86400:
        print(f'[spam] timing trap bucket={bucket} ip={ip} age={age:.1f}s')
        raise SilentDrop()

    invalid = check_strings(body)
    if invalid:
        return invalid

    if rate_limit_hit(bucket, ip, limit):
        return 'RATE_LIMIT'
    return None


def clean(value, cap=MAX_STRING):
    """Trim + cap AND strip control characters. Control characters matter: a
    cleaned value can end up as a SES Reply-To header, and a stray CR/LF there
    makes SES reject the whole send (losing the notification silently)."""
    if value is None:
        return ''
    return CONTROL_CHARS.sub('', str(value)).strip()[:cap]


def valid_email(value):
    return bool(value) and bool(EMAIL_RE.match(value))


# ──────────────────────────────────────────────────────────────
# Branded email
# ──────────────────────────────────────────────────────────────
INK = '#1C0E3E'
INK_DEEP = '#140A2E'
GOLD = '#F5B027'
TEAL = '#22C7C0'
MAGENTA = '#9C1F5B'
TEXT = '#2A1452'
MUTED = '#6B5A8A'
PAPER = '#F6F1FB'


def email_shell(title, eyebrow_html, sections_html, footer_note):
    return f"""<div style="margin:0;padding:0;background:{PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(30,11,59,0.12);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td style="background:{INK};background-image:linear-gradient(135deg,{INK_DEEP} 0%,{INK} 55%,#241348 100%);padding:28px 24px;text-align:center;">
    <img src="{LOGO_URL}" alt="CAL-ABA" width="64" height="64" style="display:block;margin:0 auto 10px;width:64px;height:64px;object-fit:contain;border:0;" />
    <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.2px;">{title}</div>
    {eyebrow_html}
  </td></tr>
  <tr><td style="height:4px;background:{TEAL};background-image:linear-gradient(90deg,{TEAL} 0%,{GOLD} 35%,#EE4B3C 68%,#D6337A 100%);line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:26px 28px 8px;">
    {sections_html}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 8px;">
      <tr><td style="background:{GOLD};border-radius:999px;">
        <a href="{ADMIN_URL}" style="display:inline-block;padding:13px 30px;color:{TEXT};font-size:15px;font-weight:700;text-decoration:none;">Open the admin dashboard</a>
      </td></tr>
    </table>
    <div style="color:{MUTED};font-size:12px;text-align:center;margin-bottom:8px;">{ADMIN_URL}</div>
  </td></tr>
  <tr><td style="background:{INK_DEEP};padding:18px 24px;text-align:center;">
    <div style="color:#F4EEFB;font-size:13px;font-weight:600;">CAL-ABA — Children Are Limitless</div>
    <div style="color:#B9A8D4;font-size:12px;margin-top:4px;">{footer_note}</div>
  </td></tr>
</table>
</td></tr></table></div>"""


def eyebrow(text):
    return (f'<div style="color:{MAGENTA};font-size:11px;font-weight:700;letter-spacing:1.2px;'
            f'text-transform:uppercase;margin:0 0 8px;">{html.escape(text)}</div>')


def rows_table(rows):
    cells = ''.join(
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #EDE6DC;color:{MUTED};font-size:13px;width:42%;">'
        f'{html.escape(label)}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #EDE6DC;color:{TEXT};font-size:14px;font-weight:600;">'
        f'{value_html}</td></tr>'
        for label, value_html in rows
    )
    return ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="border-collapse:collapse;margin-bottom:24px;">{cells}</table>')


def quote_block(text, color=TEAL):
    return (f'<div style="background:{PAPER};border-left:3px solid {color};border-radius:0 10px 10px 0;'
            f'padding:16px 18px;color:{TEXT};font-size:15px;line-height:1.7;white-space:pre-wrap;'
            f'margin-bottom:24px;">{html.escape(text)}</div>')


def dash(value):
    text = (value or '').strip()
    return html.escape(text) if text else '&mdash;'


def send_email(subject, html_body, reply_to=None):
    """Store-first-then-email: never raises. SES is not yet DKIM-verified."""
    try:
        kwargs = {
            'Source': SES_FROM,
            'Destination': {'ToAddresses': [NOTIFY_EMAIL]},
            'Message': {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}},
            },
        }
        # A malformed / header-injected Reply-To makes SES reject the entire
        # send, so it is validated rather than trusted.
        if valid_email(reply_to):
            kwargs['ReplyToAddresses'] = [reply_to]
        elif reply_to:
            print(f'[ses] dropping unusable Reply-To (len={len(reply_to)})')
        ses.send_email(**kwargs)
        return True
    except Exception as exc:
        # Deliberately swallowed. The record is already durable in S3 and the
        # admin dashboard is the source of truth; email is a convenience.
        print(f'[ses] send failed (record already stored) subject={subject!r} err={exc}')
        return False


def review_email(record):
    sub = record['submission']
    stars = '★' * int(sub.get('rating') or 0) + '☆' * (5 - int(sub.get('rating') or 0))
    consent = sub.get('consent') is True
    consent_text = ('YES — may be published on the website' if consent
                    else 'NO — private feedback only')
    banner = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
              f'style="background:#FBF6EC;border-left:3px solid {GOLD};border-radius:0 10px 10px 0;margin-bottom:24px;">'
              f'<tr><td style="padding:14px 16px;">'
              f'<div style="color:{MAGENTA};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">Permission to publish</div>'
              f'<div style="color:{TEXT};font-size:15px;font-weight:700;">{html.escape(consent_text)}</div>'
              f'<div style="color:{MUTED};font-size:13px;margin-top:6px;">Credit as: <strong style="color:{TEXT};">{dash(sub.get("credit"))}</strong></div>'
              f'</td></tr></table>')
    body = (
        banner
        + eyebrow('The review')
        + f'<div style="color:{TEXT};font-size:18px;font-weight:700;line-height:1.4;margin-bottom:10px;">{dash(sub.get("headline"))}</div>'
        + quote_block(sub.get('review') or '')
        + eyebrow('Reviewer')
        + rows_table([
            ('Name', dash(sub.get('name'))),
            ('Email', f'<a href="mailto:{html.escape(sub.get("email") or "")}" style="color:#0E5A56;text-decoration:none;">{dash(sub.get("email"))}</a>'),
            ('Relationship', dash(sub.get('relationship'))),
            ('Service received', dash(sub.get('service'))),
            ('City / county', dash(sub.get('location'))),
            ('Rating', f'{int(sub.get("rating") or 0)} / 5'),
        ])
    )
    eyebrow_html = (
        f'<div style="color:#FFC44D;font-size:26px;letter-spacing:4px;margin-top:10px;">{stars}</div>'
        f'<div style="color:#F4EEFB;font-size:14px;font-weight:600;margin-top:4px;">{int(sub.get("rating") or 0)} out of 5</div>'
        f'<div style="color:#B9A8D4;font-size:13px;margin-top:8px;">{html.escape(record["createdAt"])}</div>'
    )
    subject_prefix = '' if consent else '[PRIVATE FEEDBACK] '
    subject = f'{subject_prefix}New review — {(sub.get("name") or "Anonymous")[:60]}'
    return subject, email_shell(
        'New review submitted', eyebrow_html, body,
        'Reviews are held for your approval — nothing is published automatically',
    )


def application_email(record):
    values = record['values']
    resume = record.get('resume') or {}
    resume_line = (html.escape(resume.get('filename', '')) + ' — open it from the admin dashboard'
                   if resume.get('key') else 'No résumé attached')
    body = (
        eyebrow('Position')
        + f'<div style="color:{TEXT};font-size:18px;font-weight:700;line-height:1.4;margin-bottom:18px;">{dash(values.get("position"))}</div>'
        + eyebrow('Applicant')
        + rows_table([
            ('Name', dash(values.get('name'))),
            ('Email', f'<a href="mailto:{html.escape(values.get("email") or "")}" style="color:#0E5A56;text-decoration:none;">{dash(values.get("email"))}</a>'),
            ('Phone', f'<a href="tel:{html.escape(re.sub(r"[^0-9+]", "", values.get("phone") or ""))}" style="color:#0E5A56;text-decoration:none;">{dash(values.get("phone"))}</a>'),
            ('Date of birth', dash(values.get('dob'))),
            ('Address', dash(', '.join(p for p in [
                values.get('street'), values.get('city'), values.get('region'),
                values.get('postal'), values.get('country')] if (p or '').strip()))),
            ('Desired wage', dash(values.get('wage'))),
            ('Right to work in the US', dash(values.get('rightToWork'))),
            ('Résumé', resume_line),
        ])
        + eyebrow('References')
        + quote_block(values.get('references') or '—', MAGENTA)
    )
    eyebrow_html = (f'<div style="color:#B9A8D4;font-size:13px;margin-top:8px;">'
                    f'{html.escape(record["createdAt"])}</div>')
    subject = f'New application — {dash(values.get("position"))[:40]} — {(values.get("name") or "Applicant")[:60]}'
    return html.unescape(subject), email_shell(
        'New job application', eyebrow_html, body,
        'Open the dashboard to read the résumé — attachments are never emailed',
    )


# ──────────────────────────────────────────────────────────────
# Derivations
# ──────────────────────────────────────────────────────────────
def initials_from(location, name):
    for source in (location, name):
        words = re.findall(r'[A-Za-z]+', source or '')
        if words:
            letters = ''.join(w[0] for w in words[:2]).upper()
            if letters:
                return letters
    return 'CA'


def attribution_from(credit, name, relationship):
    credit = (credit or '').strip()
    name = (name or '').strip()
    parts = name.split()
    if credit == 'Use my full name':
        return name or 'CAL-ABA family'
    if credit == 'Post anonymously':
        return 'Anonymous'
    if credit == 'First name and last initial':
        if len(parts) >= 2:
            return f'{parts[0]} {parts[-1][0].upper()}.'
        return parts[0] if parts else 'Anonymous'
    if credit.startswith('Parent of'):
        return (relationship or 'Parent / caregiver').strip()
    return (relationship or 'CAL-ABA family').strip()


def derive_display(submission, order):
    return {
        'quote': submission.get('review', ''),
        'attribution': attribution_from(
            submission.get('credit'), submission.get('name'), submission.get('relationship')),
        'location': submission.get('location', ''),
        'service': submission.get('service', ''),
        'initials': ('?' if (submission.get('credit') or '').strip() == 'Post anonymously'
                     else initials_from(submission.get('location'), submission.get('name'))),
        'rating': int(submission.get('rating') or 5),
        'order': order,
    }


def sanitize_filename(name):
    """Sanitise the STEM only and re-attach the extension. Sanitising the whole
    string destroyed the extension for non-Latin names (`简历.pdf` collapsed to
    `pdf`, which then failed the extension allow-list)."""
    base = os.path.basename(unquote(str(name or 'resume')).replace('\\', '/'))
    base = CONTROL_CHARS.sub('', base)
    stem, ext = os.path.splitext(base)
    ext = '.' + re.sub(r'[^A-Za-z0-9]+', '', ext).lower()[:8] if ext else ''
    if ext == '.':
        ext = ''
    stem = re.sub(r'[^A-Za-z0-9._-]+', '-', stem).strip('-._')[:100] or 'resume'
    return f'{stem}{ext}'


# ──────────────────────────────────────────────────────────────
# Public routes
# ──────────────────────────────────────────────────────────────
PUBLIC_CACHE = {'Cache-Control': 'public,max-age=300'}


def public_testimonials(origin):
    reviews = read_json(K_REVIEWS, [])
    if not isinstance(reviews, list):
        raise StoreUnavailable('reviews.json is not a list')
    items = [
        r['display'] for r in reviews
        if r.get('status') == 'approved'
        and (r.get('submission') or {}).get('consent') is True
        and isinstance(r.get('display'), dict)
    ]
    items.sort(key=lambda d: (d.get('order', 0), d.get('quote', '')))
    return respond(200, items, origin, PUBLIC_CACHE)


def public_staff(origin):
    raw = read_json(K_STAFF, [])
    if not isinstance(raw, list):
        raise StoreUnavailable('staff.json is not a list')
    staff = [s for s in raw if isinstance(s, dict) and s.get('active') is not False]
    staff.sort(key=lambda s: (s.get('order', 0), s.get('name', '')))
    founder = None
    team = []
    for member in staff:
        photo = member.get('photo') if isinstance(member.get('photo'), dict) else None
        if not (photo or {}).get('url'):
            photo = None
        if member.get('isFounder') and founder is None:
            # The founder is never dropped — Founder.tsx keeps its bundled photo
            # when the API sends none.
            founder = {
                'name': member.get('name', ''),
                'title': member.get('title', ''),
                'credentials': member.get('credentials') or [],
                'photo': photo,
            }
        elif photo:
            # A team member with no usable photo would render as a blank card on
            # the public site, so they are omitted until the upload lands.
            team.append({'name': member.get('name', ''), 'title': member.get('title', ''), 'photo': photo})
    return respond(200, {'founder': founder, 'team': team}, origin, PUBLIC_CACHE)


def post_review(event, body, origin):
    ip = client_ip(event)
    try:
        gate = spam_gate(body, ip, 'reviews', 5)
    except SilentDrop:
        return respond(200, {'ok': True, 'id': None}, origin)
    if gate == 'RATE_LIMIT':
        return err(429, 'Too many reviews from this connection. Please try again later.', origin)
    if gate:
        return err(400, gate, origin)

    try:
        rating = int(body.get('rating') or 0)
    except (TypeError, ValueError):
        rating = 0
    if rating < 1 or rating > 5:
        return err(400, 'Please choose a rating between 1 and 5.', origin)
    review_text = clean(body.get('review'), LONG_STRINGS['review'])
    if len(review_text) < 10:
        return err(400, 'Please tell us a little more about your experience.', origin)

    submission = {
        'rating': rating,
        'headline': clean(body.get('headline')),
        'review': review_text,
        'name': clean(body.get('name')),
        'credit': clean(body.get('credit')),
        'email': clean(body.get('email'), 254),
        'relationship': clean(body.get('relationship')),
        'location': clean(body.get('location')),
        'service': clean(body.get('service')),
        'consent': body.get('consent') is True,
    }

    record = {
        'id': new_id('rv', 8),
        'createdAt': now_iso(),
        'status': 'pending',
        'submission': submission,
        'display': derive_display(submission, 0),
        'moderation': {'decidedAt': None, 'decidedBy': None, 'note': ''},
        'source': {'ip': ip, 'userAgent': user_agent(event)},
    }

    def apply(reviews):
        if not isinstance(reviews, list):
            raise StoreUnavailable('reviews.json is not a list')
        record['display']['order'] = len(reviews)
        return reviews + [record], None

    mutate_json(K_REVIEWS, [], apply)       # store FIRST (503 on failure)

    subject, body_html = review_email(record)
    send_email(subject, body_html, submission['email'])   # then email (never fatal)
    return respond(200, {'ok': True, 'id': record['id']}, origin)


def post_upload_url(event, body, origin):
    ip = client_ip(event)
    try:
        gate = spam_gate(body, ip, 'upload-url', 5)
    except SilentDrop:
        return respond(200, {'ok': True, 'uploadId': None, 'skip': True}, origin)
    if gate == 'RATE_LIMIT':
        return err(429, 'Too many upload requests. Please try again later.', origin)
    if gate:
        return err(400, gate, origin)

    filename = sanitize_filename(body.get('filename'))
    ext = os.path.splitext(filename)[1].lower()
    if ext not in RESUME_EXTS:
        return err(400, f'Résumé must be one of: {", ".join(RESUME_EXTS)}', origin)
    try:
        size = int(body.get('size') or 0)
    except (TypeError, ValueError):
        size = 0
    if size < 1 or size > MAX_RESUME_BYTES:
        return err(400, 'Résumé must be between 1 byte and 5 MB.', origin)
    # Derived from the validated extension — the client-supplied contentType is
    # ignored so it can never be pinned into the presigned policy (and later
    # replayed back to an admin's browser as e.g. text/html).
    content_type = RESUME_MIME.get(ext, 'application/octet-stream')

    upload_id = secrets.token_hex(8)
    key = f'private/resumes/incoming/{upload_id}/{filename}'
    try:
        presigned = s3.generate_presigned_post(
            Bucket=S3_BUCKET,
            Key=key,
            Fields={'Content-Type': content_type},
            Conditions=[
                {'key': key},
                {'Content-Type': content_type},
                ['content-length-range', 1, MAX_RESUME_BYTES],
            ],
            ExpiresIn=300,
        )
    except Exception as exc:
        print(f'[upload-url] presign failed err={exc}')
        return err(500, 'Could not prepare the upload. Please try again.', origin)

    return respond(200, {
        'ok': True,
        'uploadId': upload_id,
        'filename': filename,
        'url': presigned['url'],
        'fields': presigned['fields'],
        'expiresIn': 300,
    }, origin)


def post_application(event, body, origin):
    ip = client_ip(event)
    try:
        gate = spam_gate(body, ip, 'applications', 3)
    except SilentDrop:
        return respond(200, {'ok': True, 'id': None}, origin)
    if gate == 'RATE_LIMIT':
        return err(429, 'Too many applications from this connection. Please try again later.', origin)
    if gate:
        return err(400, gate, origin)

    raw_values = body.get('values')
    if not isinstance(raw_values, dict):
        return err(400, 'Missing application details.', origin)
    fields = ('name', 'email', 'phone', 'dob', 'street', 'city', 'region', 'postal',
              'country', 'position', 'wage', 'rightToWork', 'references')
    values = {f: clean(raw_values.get(f), LONG_STRINGS.get(f, MAX_STRING)) for f in fields}
    if not values['name'] or '@' not in values['email']:
        return err(400, 'Name and a valid email address are required.', origin)

    application_id = new_id('ap', 4)
    resume = None
    upload_id = clean(body.get('uploadId'), 64)
    if upload_id and re.fullmatch(r'[a-f0-9]{8,32}', upload_id):
        filename = sanitize_filename(body.get('filename') or 'resume.pdf')
        src = f'private/resumes/incoming/{upload_id}/{filename}'
        dest = f'private/resumes/{application_id}/{filename}'
        try:
            head = s3.head_object(Bucket=S3_BUCKET, Key=src)
            s3.copy_object(Bucket=S3_BUCKET, Key=dest,
                           CopySource={'Bucket': S3_BUCKET, 'Key': src},
                           MetadataDirective='COPY', ServerSideEncryption='AES256')
            s3.delete_object(Bucket=S3_BUCKET, Key=src)
            resume = {
                'key': dest,
                'filename': filename,
                'size': head.get('ContentLength', 0),
                'contentType': head.get('ContentType', 'application/octet-stream'),
            }
        except Exception as exc:
            # Never lose the application because the résumé move failed.
            print(f'[application] resume move failed uploadId={upload_id} err={exc}')

    record = {
        'id': application_id,
        'createdAt': now_iso(),
        'status': 'new',
        'values': values,
        'resume': resume,
        'source': {'ip': ip, 'userAgent': user_agent(event)},
    }

    def apply(applications):
        if not isinstance(applications, list):
            raise StoreUnavailable('applications.json is not a list')
        return applications + [record], None

    mutate_json(K_APPLICATIONS, [], apply)       # store FIRST (503 on failure)

    subject, body_html = application_email(record)
    send_email(subject, body_html, values['email'])
    return respond(200, {'ok': True, 'id': record['id']}, origin)


# ──────────────────────────────────────────────────────────────
# Auth routes
# ──────────────────────────────────────────────────────────────
def public_user(user):
    return {
        'id': user['id'], 'email': user['email'],
        'name': user.get('name', ''), 'role': user.get('role', 'staff'),
        'createdAt': user.get('createdAt'), 'lastLoginAt': user.get('lastLoginAt'),
    }


DUMMY_SALT = '0' * 32


def load_users():
    users = read_json(K_USERS, [])
    if not isinstance(users, list):
        raise StoreUnavailable('users.json is not a list')
    return users


def authenticate(event):
    """Verify the bearer token AND re-ground it in the stored user record.

    A valid signature alone is not enough: the account must still exist, and the
    token must have been issued after the last password change. `role` comes
    from the stored record, never from the (attacker-visible, but signed) claim,
    so a role downgrade takes effect immediately.

    Returns (claims, user) or (None, error_message).
    """
    claims = authed_user(event)
    if not claims:
        return None, 'Sign in to continue.'
    user = next((u for u in load_users() if u.get('id') == claims.get('sub')), None)
    if not user:
        return None, 'This account no longer exists. Please sign in again.'
    # `<=`, not `<`: iat has one-second granularity, so a token minted in the
    # same second as the password change would otherwise survive it.
    if int(claims.get('iat') or 0) <= int(user.get('tokenValidFrom') or 0):
        return None, 'Your session ended when the password changed. Please sign in again.'
    grounded = dict(claims)
    grounded['role'] = user.get('role', 'staff')
    grounded['email'] = user.get('email', claims.get('email', ''))
    return grounded, user


def auth_login(event, body, origin):
    ip = client_ip(event)
    email = clean(body.get('email'), 254).lower()
    password = str(body.get('password') or '')
    if not email or not password:
        return err(400, 'Email and password are required.', origin)

    if login_locked(ip, email):
        # The exact remaining seconds are withheld — they tell an attacker
        # precisely when to resume.
        return err(429, 'Too many failed attempts. Try again in a few minutes.', origin)

    users = load_users()
    match = next((u for u in users if (u.get('email') or '').lower() == email), None)
    if match is None:
        # Same PBKDF2 cost as a real check so response time does not disclose
        # whether the address has an account.
        hash_password(password, DUMMY_SALT)
        ok = False
    else:
        ok = verify_password(password, match.get('salt', ''), match.get('passwordHash', ''))
    if not ok:
        login_failed(ip, email)
        return err(401, 'Invalid email or password.', origin)

    login_succeeded(ip, email)

    stamp = now_iso()

    def apply(records):
        if not isinstance(records, list):
            raise StoreUnavailable('users.json is not a list')
        found = next((u for u in records if u.get('id') == match['id']), None)
        if not found:
            return None, None
        found['lastLoginAt'] = stamp
        return records, found

    try:
        fresh = mutate_json(K_USERS, [], apply) or match
    except StoreUnavailable as exc:
        # lastLoginAt is a convenience field; a store hiccup must not block a
        # sign-in that already passed verification.
        print(f'[login] could not record lastLoginAt err={exc}')
        fresh = match

    return respond(200, {'token': create_token(fresh), 'user': public_user(fresh),
                         'expiresIn': TOKEN_TTL}, origin)


def auth_refresh(user, origin):
    return respond(200, {'token': create_token(user), 'user': public_user(user),
                         'expiresIn': TOKEN_TTL}, origin)


def auth_change_password(user, body, origin):
    current = str(body.get('currentPassword') or '')
    new_password = str(body.get('newPassword') or '')
    if len(new_password) < 12:
        return err(400, 'New password must be at least 12 characters.', origin)
    if not verify_password(current, user.get('salt', ''), user.get('passwordHash', '')):
        return err(401, 'Current password is incorrect.', origin)

    salt, digest = hash_password(new_password)
    changed_at = int(time.time())

    def apply(records):
        if not isinstance(records, list):
            raise StoreUnavailable('users.json is not a list')
        found = next((u for u in records if u.get('id') == user['id']), None)
        if not found:
            return None, None
        found['salt'], found['passwordHash'] = salt, digest
        found['passwordChangedAt'] = now_iso()
        # Every token issued before this instant stops working everywhere.
        found['tokenValidFrom'] = changed_at
        return records, found

    updated = mutate_json(K_USERS, [], apply)
    if not updated:
        return err(401, 'Account no longer exists.', origin)
    # Hand back a token stamped one second PAST the cut-off, so the admin who
    # just changed their own password keeps the tab they are sitting in while
    # every other session — including one issued in this same second — dies.
    return respond(200, {'ok': True, 'token': create_token(updated, changed_at + 1),
                         'user': public_user(updated), 'expiresIn': TOKEN_TTL}, origin)


# ──────────────────────────────────────────────────────────────
# Admin: reviews
# ──────────────────────────────────────────────────────────────
def admin_reviews_list(event, origin):
    reviews = read_json(K_REVIEWS, [])
    if not isinstance(reviews, list):
        raise StoreUnavailable('reviews.json is not a list')
    counts = {s: 0 for s in REVIEW_STATUSES}
    for r in reviews:
        if r.get('status') in counts:
            counts[r['status']] += 1
    status = ((event.get('queryStringParameters') or {}) or {}).get('status')
    if status in REVIEW_STATUSES:
        reviews = [r for r in reviews if r.get('status') == status]
    reviews = sorted(reviews, key=lambda r: r.get('createdAt', ''), reverse=True)
    return respond(200, {'items': reviews, 'counts': counts}, origin)


def admin_review_update(claims, review_id, body, origin):
    def apply(reviews):
        if not isinstance(reviews, list):
            raise StoreUnavailable('reviews.json is not a list')
        match = next((r for r in reviews if r.get('id') == review_id), None)
        if not match:
            return None, err(404, 'Review not found.', origin)

        if 'status' in body:
            status = clean(body.get('status'), 20)
            if status not in REVIEW_STATUSES:
                return None, err(400, 'Status must be pending, approved or rejected.', origin)
            # Consent gate — enforced server-side regardless of the client.
            if status == 'approved' and (match.get('submission') or {}).get('consent') is not True:
                return None, err(
                    403, 'This reviewer asked for private feedback — it cannot be published.', origin)
            match['status'] = status
            match['moderation'] = {
                'decidedAt': now_iso(),
                'decidedBy': claims.get('email'),
                'note': clean(body.get('note'), MAX_STRING) or (match.get('moderation') or {}).get('note', ''),
            }

        display_patch = body.get('display')
        if isinstance(display_patch, dict):
            display = dict(match.get('display') or {})
            for field in ('quote', 'attribution', 'location', 'service', 'initials'):
                if field in display_patch:
                    display[field] = clean(
                        display_patch[field],
                        LONG_STRINGS['review'] if field == 'quote' else MAX_STRING)
            if 'rating' in display_patch:
                try:
                    display['rating'] = max(1, min(5, int(display_patch['rating'])))
                except (TypeError, ValueError):
                    pass
            if 'order' in display_patch:
                try:
                    display['order'] = int(display_patch['order'])
                except (TypeError, ValueError):
                    pass
            match['display'] = display

        if 'order' in body:
            try:
                match.setdefault('display', {})['order'] = int(body['order'])
            except (TypeError, ValueError):
                pass

        return reviews, respond(200, match, origin)

    return mutate_json(K_REVIEWS, [], apply)


def admin_review_delete(review_id, origin):
    def apply(reviews):
        if not isinstance(reviews, list):
            raise StoreUnavailable('reviews.json is not a list')
        remaining = [r for r in reviews if r.get('id') != review_id]
        if len(remaining) == len(reviews):
            return None, err(404, 'Review not found.', origin)
        return remaining, respond(200, {'ok': True, 'id': review_id}, origin)

    return mutate_json(K_REVIEWS, [], apply)


# ──────────────────────────────────────────────────────────────
# Admin: staff
# ──────────────────────────────────────────────────────────────
def admin_staff_list(origin):
    staff = read_json(K_STAFF, [])
    if not isinstance(staff, list):
        raise StoreUnavailable('staff.json is not a list')
    staff = sorted(staff, key=lambda s: (s.get('order', 0), s.get('name', '')))
    return respond(200, {'items': staff}, origin)


def _coerce_int(value, field, origin, default=None):
    """Returns (value, error_response). Coercion happens BEFORE any write so a
    bad number can never leave a half-applied mutation behind."""
    if value is None or value == '':
        return default, None
    try:
        return int(value), None
    except (TypeError, ValueError):
        return None, err(400, f'"{field}" must be a whole number.', origin)


def admin_staff_create(body, origin):
    name = clean(body.get('name'))
    if not name:
        return err(400, 'Name is required.', origin)
    order, order_error = _coerce_int(body.get('order'), 'order', origin)
    if order_error:
        return order_error

    def apply(staff):
        if not isinstance(staff, list):
            raise StoreUnavailable('staff.json is not a list')
        stamp = now_iso()
        record = {
            'id': new_id('st', 4),
            'name': name,
            'title': clean(body.get('title')),
            'isFounder': body.get('isFounder') is True,
            'active': body.get('active') is not False,
            'order': len(staff) if order is None else order,
            'photo': None,
            'credentials': [clean(c, 60) for c in (body.get('credentials') or []) if isinstance(c, str)][:8],
            'createdAt': stamp,
            'updatedAt': stamp,
        }
        return staff + [record], respond(200, record, origin)

    return mutate_json(K_STAFF, [], apply)


def admin_staff_update(staff_id, body, origin):
    order, order_error = _coerce_int(body.get('order'), 'order', origin) if 'order' in body else (None, None)
    if order_error:
        return order_error

    def apply(staff):
        if not isinstance(staff, list):
            raise StoreUnavailable('staff.json is not a list')
        match = next((s for s in staff if s.get('id') == staff_id), None)
        if not match:
            return None, err(404, 'Team member not found.', origin)
        if 'name' in body:
            match['name'] = clean(body['name']) or match['name']
        if 'title' in body:
            match['title'] = clean(body['title'])
        if 'isFounder' in body:
            match['isFounder'] = body['isFounder'] is True
        if 'active' in body:
            match['active'] = body['active'] is not False
        if 'order' in body and order is not None:
            match['order'] = order
        if isinstance(body.get('credentials'), list):
            match['credentials'] = [clean(c, 60) for c in body['credentials'] if isinstance(c, str)][:8]
        match['updatedAt'] = now_iso()
        return staff, respond(200, match, origin)

    return mutate_json(K_STAFF, [], apply)


def admin_staff_delete(staff_id, origin):
    def apply(staff):
        if not isinstance(staff, list):
            raise StoreUnavailable('staff.json is not a list')
        match = next((s for s in staff if s.get('id') == staff_id), None)
        if not match:
            return None, (None, err(404, 'Team member not found.', origin))
        if match.get('isFounder'):
            return None, (None, err(403, 'The founder card cannot be removed.', origin))
        old_key = (match.get('photo') or {}).get('key')
        remaining = [s for s in staff if s.get('id') != staff_id]
        return remaining, (old_key, respond(200, {'ok': True, 'id': staff_id}, origin))

    old_key, response = mutate_json(K_STAFF, [], apply)
    purge_object(old_key)
    return response


def admin_staff_photo(staff_id, body, origin):
    content_type = clean(body.get('contentType'), 60).lower()
    if content_type not in PHOTO_TYPES:
        return err(400, 'Photo must be WebP, JPEG or PNG.', origin)
    data_url = body.get('data') or ''
    if isinstance(data_url, str) and data_url.startswith('data:'):
        data_url = data_url.split(',', 1)[-1]
    try:
        blob = base64.b64decode(data_url, validate=True)
    except (binascii.Error, ValueError, TypeError):
        return err(400, 'Photo payload is not valid base64.', origin)
    if not blob:
        return err(400, 'Photo is empty.', origin)
    if len(blob) > MAX_PHOTO_BYTES:
        return err(413, 'Photo must be 2 MB or smaller after decoding.', origin)

    # Coerce the dimensions BEFORE anything is written — a bad w/h used to be
    # cast after put_object, leaving an orphaned public object plus a 500.
    width, width_error = _coerce_int(body.get('w'), 'w', origin, default=0)
    if width_error:
        return width_error
    height, height_error = _coerce_int(body.get('h'), 'h', origin, default=0)
    if height_error:
        return height_error

    staff = read_json(K_STAFF, [])
    if not isinstance(staff, list):
        raise StoreUnavailable('staff.json is not a list')
    if not any(s.get('id') == staff_id for s in staff):
        return err(404, 'Team member not found.', origin)

    key = f'public/staff/{staff_id}-{int(time.time())}{PHOTO_TYPES[content_type]}'
    s3.put_object(
        Bucket=S3_BUCKET, Key=key, Body=blob, ContentType=content_type,
        CacheControl='public,max-age=31536000,immutable',
    )
    photo = {
        'key': key,
        'url': f'https://{S3_BUCKET}.s3.amazonaws.com/{key}',
        'w': max(0, width or 0),
        'h': max(0, height or 0),
    }

    def apply(records):
        if not isinstance(records, list):
            raise StoreUnavailable('staff.json is not a list')
        match = next((s for s in records if s.get('id') == staff_id), None)
        if not match:
            return None, (None, err(404, 'Team member not found.', origin))
        old_key = (match.get('photo') or {}).get('key')
        match['photo'] = photo
        match['updatedAt'] = now_iso()
        return records, (old_key, respond(200, match, origin))

    old_key, response = mutate_json(K_STAFF, [], apply)
    if response.get('statusCode') == 404:
        purge_object(key)          # nothing references the object we just wrote
    elif old_key and old_key != key:
        purge_object(old_key)
    return response


# ──────────────────────────────────────────────────────────────
# Admin: applications
# ──────────────────────────────────────────────────────────────
def admin_applications_list(event, origin):
    applications = read_json(K_APPLICATIONS, [])
    if not isinstance(applications, list):
        raise StoreUnavailable('applications.json is not a list')
    counts = {s: 0 for s in APPLICATION_STATUSES}
    for a in applications:
        if a.get('status') in counts:
            counts[a['status']] += 1
    status = ((event.get('queryStringParameters') or {}) or {}).get('status')
    if status in APPLICATION_STATUSES:
        applications = [a for a in applications if a.get('status') == status]
    applications.sort(key=lambda a: a.get('createdAt', ''), reverse=True)
    return respond(200, {'items': applications, 'counts': counts}, origin)


def load_applications():
    applications = read_json(K_APPLICATIONS, [])
    if not isinstance(applications, list):
        raise StoreUnavailable('applications.json is not a list')
    return applications


def admin_application_get(application_id, origin):
    match = next((a for a in load_applications() if a.get('id') == application_id), None)
    if not match:
        return err(404, 'Application not found.', origin)
    return respond(200, match, origin)


def admin_application_resume(application_id, origin):
    match = next((a for a in load_applications() if a.get('id') == application_id), None)
    if not match:
        return err(404, 'Application not found.', origin)
    resume = match.get('resume') or {}
    key = resume.get('key')
    if not key:
        return err(404, 'No résumé attached to this application.', origin)

    # The served Content-Type is derived from the STORED key's extension, never
    # from head_object (which reflects whatever the uploader sent) and never
    # from the client. Only a real PDF is allowed to render inline; everything
    # else is forced to download so the admin's browser cannot be tricked into
    # executing an uploaded document in the S3 origin.
    filename = sanitize_filename(resume.get('filename') or os.path.basename(key))
    ext = os.path.splitext(key)[1].lower()
    content_type = RESUME_MIME.get(ext, 'application/octet-stream')
    inline = content_type == 'application/pdf'
    disposition = (f'inline; filename="{filename}"' if inline
                   else f'attachment; filename="{filename}"')
    try:
        # Minted fresh on every request — presigned links are never emailed.
        url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': key,
                'ResponseContentType': content_type,
                'ResponseContentDisposition': disposition,
            },
            ExpiresIn=RESUME_LINK_TTL,
        )
    except Exception as exc:
        print(f'[resume] presign failed id={application_id} err={exc}')
        return err(500, 'Could not open the résumé.', origin)
    return respond(200, {
        'url': url,
        'filename': filename,
        'contentType': content_type,
        'inline': inline,
        'expiresIn': RESUME_LINK_TTL,
    }, origin)


def admin_application_update(application_id, body, origin):
    status = clean(body.get('status'), 20)
    if status not in APPLICATION_STATUSES:
        return err(400, 'Status must be new, reviewed, contacted or rejected.', origin)

    def apply(applications):
        if not isinstance(applications, list):
            raise StoreUnavailable('applications.json is not a list')
        match = next((a for a in applications if a.get('id') == application_id), None)
        if not match:
            return None, err(404, 'Application not found.', origin)
        match['status'] = status
        match['updatedAt'] = now_iso()
        return applications, respond(200, match, origin)

    return mutate_json(K_APPLICATIONS, [], apply)


def admin_application_delete(application_id, origin):
    def apply(applications):
        if not isinstance(applications, list):
            raise StoreUnavailable('applications.json is not a list')
        match = next((a for a in applications if a.get('id') == application_id), None)
        if not match:
            return None, (None, err(404, 'Application not found.', origin))
        resume_key = (match.get('resume') or {}).get('key')
        remaining = [a for a in applications if a.get('id') != application_id]
        return remaining, (resume_key, respond(200, {'ok': True, 'id': application_id}, origin))

    resume_key, response = mutate_json(K_APPLICATIONS, [], apply)
    # Purge every version — the bucket is versioned, so a plain delete would
    # leave the résumé (PII) readable for the 90-day noncurrent lifecycle.
    purge_object(resume_key)
    return response


# ──────────────────────────────────────────────────────────────
# Admin: users (owner only)
# ──────────────────────────────────────────────────────────────
def admin_users_list(origin):
    return respond(200, {'items': [public_user(u) for u in load_users()]}, origin)


def admin_users_create(body, origin):
    email = clean(body.get('email'), 254).lower()
    password = str(body.get('password') or '')
    if not valid_email(email):
        return err(400, 'A valid email address is required.', origin)
    if len(password) < 12:
        return err(400, 'Password must be at least 12 characters.', origin)
    role = clean(body.get('role'), 20) or 'staff'
    if role not in ('owner', 'staff'):
        return err(400, 'Role must be owner or staff.', origin)
    salt, digest = hash_password(password)
    name = clean(body.get('name'))

    def apply(users):
        if not isinstance(users, list):
            raise StoreUnavailable('users.json is not a list')
        if any((u.get('email') or '').lower() == email for u in users):
            return None, err(409, 'That email already has an account.', origin)
        record = {
            'id': new_id('usr', 4), 'email': email, 'name': name,
            'role': role, 'salt': salt, 'passwordHash': digest,
            'createdAt': now_iso(), 'lastLoginAt': None, 'tokenValidFrom': 0,
        }
        return users + [record], respond(200, public_user(record), origin)

    return mutate_json(K_USERS, [], apply)


def admin_users_delete(claims, user_id, origin):
    def apply(users):
        if not isinstance(users, list):
            raise StoreUnavailable('users.json is not a list')
        match = next((u for u in users if u.get('id') == user_id), None)
        if not match:
            return None, err(404, 'Account not found.', origin)
        if match['id'] == claims.get('sub'):
            return None, err(400, 'You cannot delete your own account.', origin)
        if match.get('role') == 'owner' and sum(1 for u in users if u.get('role') == 'owner') <= 1:
            return None, err(400, 'Cannot delete the last owner account.', origin)
        return [u for u in users if u.get('id') != user_id], respond(
            200, {'ok': True, 'id': user_id}, origin)

    return mutate_json(K_USERS, [], apply)


# ──────────────────────────────────────────────────────────────
# Dispatch
# ──────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    origin = _origin(event)
    method = (event.get('httpMethod') or 'GET').upper()
    path = (event.get('path') or '/').rstrip('/') or '/'

    if method == 'OPTIONS':
        return respond(204, {}, origin)

    try:
        segments = [s for s in path.split('/') if s]
        is_login = method == 'POST' and path == '/api/auth/login'
        needs_auth = (path.startswith('/api/auth/') or path.startswith('/api/admin')) and not is_login

        # ---------- AUTH GATE (before any body handling) ----------
        # An expired/absent token must cost nothing and must answer 401 — the
        # client's re-auth overlay keys off that status. Decoding a multi-MB
        # base64 photo body first meant an expired session got a 400 (or a 500
        # on malformed base64) and the overlay never fired.
        claims = user = None
        if needs_auth:
            claims, user_or_reason = authenticate(event)
            if claims is None:
                return err(401, user_or_reason, origin)
            user = user_or_reason
        elif not (path.startswith('/api/') or path == '/'):
            return err(404, 'Not found', origin)

        # ---------- BODY ----------
        # Photo route is exempt from the 64KB JSON cap (base64 image payload).
        is_photo = method == 'POST' and re.fullmatch(r'/api/admin/staff/[^/]+/photo', path)
        if method in ('POST', 'PUT', 'DELETE'):
            if is_photo:
                try:
                    raw = event.get('body') or ''
                    if event.get('isBase64Encoded'):
                        raw = base64.b64decode(raw).decode('utf-8')
                    body = json.loads(raw) if raw.strip() else {}
                except Exception:
                    return err(400, 'Malformed request body', origin)
                if not isinstance(body, dict):
                    return err(400, 'Body must be a JSON object', origin)
            else:
                body, body_error = parse_body(event)
                if body_error:
                    return err(413 if 'too large' in body_error else 400, body_error, origin)
        else:
            body = {}

        # ---------- PUBLIC ----------
        if method == 'GET' and path == '/api/public/testimonials':
            return public_testimonials(origin)
        if method == 'GET' and path == '/api/public/staff':
            return public_staff(origin)
        if method == 'POST' and path == '/api/reviews':
            return post_review(event, body, origin)
        if method == 'POST' and path == '/api/applications/upload-url':
            return post_upload_url(event, body, origin)
        if method == 'POST' and path == '/api/applications':
            return post_application(event, body, origin)
        if method == 'GET' and path in ('/', '/api', '/api/health'):
            # `conditionalWrites` tells an operator whether the runtime's botocore
            # is new enough for ETag-guarded puts. It leaks nothing.
            return respond(200, {'ok': True, 'service': 'calaba-site-api',
                                 'conditionalWrites': CONDITIONAL_WRITES}, origin)

        # ---------- AUTH ----------
        if is_login:
            return auth_login(event, body, origin)
        if not needs_auth:
            return err(404, 'Not found', origin)

        if method == 'POST' and path == '/api/auth/refresh':
            return auth_refresh(user, origin)
        if method == 'POST' and path == '/api/auth/change-password':
            return auth_change_password(user, body, origin)
        if method == 'GET' and path == '/api/auth/me':
            # The stored record, not the raw claims — a role or name changed
            # after the token was minted must be reflected immediately.
            return respond(200, {'user': public_user(user)}, origin)

        # ---------- ADMIN ----------
        # segments: ['api','admin',<resource>, <id?>, <sub?>]
        if len(segments) < 3 or segments[0] != 'api' or segments[1] != 'admin':
            return err(404, 'Not found', origin)
        resource = segments[2]
        rid = segments[3] if len(segments) > 3 else None
        sub = segments[4] if len(segments) > 4 else None

        if resource == 'reviews':
            if method == 'GET' and not rid:
                return admin_reviews_list(event, origin)
            if method == 'PUT' and rid:
                return admin_review_update(claims, rid, body, origin)
            if method == 'DELETE' and rid:
                return admin_review_delete(rid, origin)

        elif resource == 'staff':
            if method == 'GET' and not rid:
                return admin_staff_list(origin)
            if method == 'POST' and not rid:
                return admin_staff_create(body, origin)
            if method == 'POST' and rid and sub == 'photo':
                return admin_staff_photo(rid, body, origin)
            if method == 'PUT' and rid and not sub:
                return admin_staff_update(rid, body, origin)
            if method == 'DELETE' and rid and not sub:
                return admin_staff_delete(rid, origin)

        elif resource == 'applications':
            if method == 'GET' and not rid:
                return admin_applications_list(event, origin)
            if method == 'GET' and rid and sub == 'resume':
                return admin_application_resume(rid, origin)
            if method == 'GET' and rid and not sub:
                return admin_application_get(rid, origin)
            if method == 'PUT' and rid and not sub:
                return admin_application_update(rid, body, origin)
            if method == 'DELETE' and rid and not sub:
                return admin_application_delete(rid, origin)

        elif resource == 'users':
            if claims.get('role') != 'owner':
                return err(403, 'Only an owner can manage accounts.', origin)
            if method == 'GET' and not rid:
                return admin_users_list(origin)
            if method == 'POST' and not rid:
                return admin_users_create(body, origin)
            if method == 'DELETE' and rid:
                return admin_users_delete(claims, rid, origin)

        return err(404, 'Not found', origin)

    except StoreUnavailable as exc:
        # The datastore was reachable-but-broken (or a write kept losing the
        # race). Refusing the request is the whole point: the old code swallowed
        # this and wrote a 1-element collection over everything that came before.
        print(f'[store] {method} {path} -> {exc}')
        return err(503, 'The service is briefly unavailable. Nothing was changed — please try again.', origin)
    except Exception as exc:
        print(f'[error] {method} {path} -> {type(exc).__name__}: {exc}')
        return err(500, 'Something went wrong. Please try again.', origin)
