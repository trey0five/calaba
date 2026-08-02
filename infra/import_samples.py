#!/usr/bin/env python3
"""
Import the bundled sample testimonials into the live reviews datastore.

  python3 infra/import_samples.py             # import, refuse if records exist
  python3 infra/import_samples.py --dry-run   # build the records, write nothing
  python3 infra/import_samples.py --force     # REPLACE whatever is in reviews.json

Why this exists
---------------
`src/content/site.ts` ships four invented testimonials as the offline fallback
for the homepage carousel. They were never in the datastore, so the owner could
see them on the site but could not edit or delete them from the admin. This
copies them in as ordinary approved Review records, at which point the admin is
the single source of truth for what the homepage shows.

The copy is READ OUT of `src/content/site.ts` rather than duplicated here, so a
wording change in the site content can never drift from what gets imported.

Every record is stamped `moderation.decidedBy = 'import'` with a note, and the
admin Reviews screen surfaces that as a "Sample copy" badge — invented copy must
never be mistaken for a family's own words.

Safe to re-run: without --force it refuses as soon as reviews.json has records,
so it can never duplicate the samples on top of genuine submissions.
"""

import argparse
import json
import os
import secrets
import sys
import time

import boto3
from botocore.exceptions import ClientError

REGION = 'us-east-1'
STACK_NAME = 'calaba-site-api'
K_REVIEWS = 'private/data/reviews.json'

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_TS = os.path.join(REPO_ROOT, 'src', 'content', 'site.ts')

IMPORT_NOTE = 'Imported sample copy — replace with a real review'
IMPORT_ACTOR = 'import'
RELATIONSHIP = 'Parent / caregiver'


# ──────────────────────────────────────────────────────────────
# Reading the samples out of site.ts
#
# A regex cannot do this safely: the quotes contain apostrophes, embedded
# double quotes and line breaks. This is a small scanner for the subset of
# JS object-literal syntax the content file actually uses.
# ──────────────────────────────────────────────────────────────
WS = ' \t\r\n'


def _skip(src, i):
    """Advance past whitespace and // or /* */ comments."""
    while i < len(src):
        if src[i] in WS:
            i += 1
        elif src.startswith('//', i):
            nl = src.find('\n', i)
            i = len(src) if nl == -1 else nl + 1
        elif src.startswith('/*', i):
            end = src.find('*/', i)
            i = len(src) if end == -1 else end + 2
        else:
            break
    return i


def _read_string(src, i):
    quote = src[i]
    i += 1
    out = []
    while i < len(src):
        ch = src[i]
        if ch == '\\':
            nxt = src[i + 1]
            out.append({'n': '\n', 't': '\t', 'r': '\r'}.get(nxt, nxt))
            i += 2
            continue
        if ch == quote:
            return ''.join(out), i + 1
        out.append(ch)
        i += 1
    raise ValueError('unterminated string in site.ts')


def _read_value(src, i):
    i = _skip(src, i)
    ch = src[i]
    if ch in '"\'`':
        return _read_string(src, i)
    if ch == '[':
        return _read_array(src, i)
    if ch == '{':
        return _read_object(src, i)
    j = i
    while j < len(src) and src[j] not in ',}]' and src[j] not in WS:
        j += 1
    token = src[i:j]
    if token == 'true':
        return True, j
    if token == 'false':
        return False, j
    if token == 'null':
        return None, j
    try:
        return (float(token) if '.' in token else int(token)), j
    except ValueError:
        raise ValueError(f'unsupported literal {token!r} in site.ts')


def _read_array(src, i):
    i += 1                                   # past '['
    out = []
    while True:
        i = _skip(src, i)
        if src[i] == ']':
            return out, i + 1
        value, i = _read_value(src, i)
        out.append(value)
        i = _skip(src, i)
        if src[i] == ',':
            i += 1


def _read_object(src, i):
    i += 1                                   # past '{'
    out = {}
    while True:
        i = _skip(src, i)
        if src[i] == '}':
            return out, i + 1
        if src[i] in '"\'':
            key, i = _read_string(src, i)
        else:
            j = i
            while src[j] not in ':' + WS:
                j += 1
            key = src[i:j]
            i = j
        i = _skip(src, i)
        if src[i] != ':':
            raise ValueError(f'expected ":" after key {key!r} in site.ts')
        value, i = _read_value(src, i + 1)
        out[key] = value
        i = _skip(src, i)
        if src[i] == ',':
            i += 1


def load_samples(path=SITE_TS):
    """Return the `testimonials` array from src/content/site.ts."""
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            src = fh.read()
    except OSError as exc:
        sys.exit(f'Could not read {path}: {exc}')

    marker = '\n  testimonials: ['
    at = src.find(marker)
    if at == -1:
        sys.exit(f'No `testimonials: [` array found in {path}.')
    items, _ = _read_array(src, at + len(marker) - 1)

    required = ('quote', 'attribution', 'location', 'service', 'initials', 'rating')
    for n, item in enumerate(items):
        missing = [f for f in required if not str(item.get(f, '')).strip()]
        if missing:
            sys.exit(f'Sample #{n + 1} is missing {", ".join(missing)} — fix site.ts first.')
    if not items:
        sys.exit('site.ts has no sample testimonials to import.')
    return items


# ──────────────────────────────────────────────────────────────
# Record building
# ──────────────────────────────────────────────────────────────
def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def build_records(samples):
    """Full Review records, shaped exactly as infra/lambda_function.py stores them."""
    stamp = now_iso()
    records = []
    for order, sample in enumerate(samples):
        rating = max(1, min(5, int(sample.get('rating') or 5)))
        quote = str(sample['quote']).strip()
        location = str(sample.get('location') or '').strip()
        service = str(sample.get('service') or '').strip()
        records.append({
            'id': f'rv_{secrets.token_hex(8)}',
            'createdAt': stamp,
            'status': 'approved',
            'submission': {
                'rating': rating,
                'headline': '',
                # The public read only ever serves `display`; `submission` is the
                # evidence pane in the admin, so it carries the same words.
                'review': quote,
                'name': '',
                'credit': '',
                'email': '',
                'relationship': RELATIONSHIP,
                'location': location,
                'service': service,
                # The consent gate in the Lambda publishes nothing without this.
                'consent': True,
            },
            'display': {
                'quote': quote,
                'attribution': str(sample['attribution']).strip(),
                'location': location,
                'service': service,
                'initials': str(sample['initials']).strip()[:3],
                'rating': rating,
                'order': order,
            },
            'moderation': {
                'decidedAt': stamp,
                'decidedBy': IMPORT_ACTOR,
                'note': IMPORT_NOTE,
            },
            'source': {'ip': '', 'userAgent': IMPORT_ACTOR},
        })
    return records


# ──────────────────────────────────────────────────────────────
# S3
# ──────────────────────────────────────────────────────────────
def stack_bucket(cfn):
    try:
        outputs = cfn.describe_stacks(StackName=STACK_NAME)['Stacks'][0]['Outputs']
    except ClientError as exc:
        sys.exit(f'Could not read stack {STACK_NAME}: {exc}\nRun ./infra/deploy.sh setup first.')
    for out in outputs:
        if out['OutputKey'] == 'BucketName':
            return out['OutputValue']
    sys.exit('Stack has no BucketName output.')


def read_json(s3, bucket, key, default):
    try:
        return json.loads(s3.get_object(Bucket=bucket, Key=key)['Body'].read().decode('utf-8'))
    except ClientError as exc:
        if exc.response['Error']['Code'] in ('NoSuchKey', '404'):
            return default
        raise


def write_json(s3, bucket, key, data):
    # Same object settings the Lambda writes with, so a later mutate_json round
    # trip does not change the encryption or caching of the object.
    s3.put_object(
        Bucket=bucket, Key=key,
        Body=json.dumps(data, indent=2).encode('utf-8'),
        ContentType='application/json', CacheControl='no-store',
        ServerSideEncryption='AES256',
    )


def main():
    parser = argparse.ArgumentParser(
        description='Import the bundled sample testimonials into reviews.json.')
    parser.add_argument('--force', action='store_true',
                        help='Replace reviews.json even if it already has records.')
    parser.add_argument('--dry-run', action='store_true',
                        help='Build the records and print the count without touching S3.')
    parser.add_argument('--bucket', help='Override the bucket from the CloudFormation stack.')
    args = parser.parse_args()

    records = build_records(load_samples())

    if args.dry_run:
        print(f'dry run: {len(records)} record(s) built, nothing written.')
        return

    session = boto3.Session(region_name=REGION)
    bucket = args.bucket or stack_bucket(session.client('cloudformation'))
    s3 = session.client('s3')

    existing = read_json(s3, bucket, K_REVIEWS, [])
    if not isinstance(existing, list):
        sys.exit(f'{K_REVIEWS} is not a list — refusing to overwrite it.')
    if existing and not args.force:
        print(f'{K_REVIEWS} already has {len(existing)} record(s) — nothing imported.')
        print('Re-run with --force ONLY if you intend to replace every review.')
        return

    write_json(s3, bucket, K_REVIEWS, records)
    print(f'imported {len(records)} review(s)')


if __name__ == '__main__':
    main()
