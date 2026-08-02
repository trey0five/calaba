#!/usr/bin/env python3
"""
Seed the CAL-ABA site datastore.

  python3 infra/seed.py            # seed staff + photos, prompt for the owner account
  python3 infra/seed.py --force    # also overwrite an existing users.json

What it does NOT do: it never seeds testimonials. reviews.json starts empty so
the bundled sample testimonials keep showing on the site until a real review is
approved in the admin dashboard.

The owner password is read with getpass — it is never echoed, never stored in
this file, and never passed on the command line.
"""

import argparse
import getpass
import hashlib
import json
import os
import secrets
import sys
import time

import boto3
from botocore.exceptions import ClientError

REGION = 'us-east-1'
STACK_NAME = 'calaba-site-api'
PBKDF2_ITERATIONS = 210_000
MIN_PASSWORD_LEN = 12

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(REPO_ROOT, 'public')

K_STAFF = 'private/data/staff.json'
K_USERS = 'private/data/auth/users.json'
K_REVIEWS = 'private/data/reviews.json'
K_APPLICATIONS = 'private/data/applications.json'

# Transcribed from the live site. `file` is the source webp in public/.
STAFF_SEED = [
    {
        'name': 'Cristina Andrade', 'title': 'Founder & Clinical Director',
        'isFounder': True, 'credentials': ['Ed.S.', 'BCBA'],
        'file': 'cristina-andrade.webp', 'w': 900, 'h': 600, 'order': 0,
    },
    {
        'name': 'Audrey Tatum', 'title': 'Clinical Supervisor',
        'isFounder': False, 'credentials': [],
        'file': 'audrey-tatum.webp', 'w': 900, 'h': 1152, 'order': 1,
    },
    {
        'name': 'Geena Roca', 'title': 'Lead RBT',
        'isFounder': False, 'credentials': [],
        'file': 'geena-roca.webp', 'w': 900, 'h': 1075, 'order': 2,
    },
    {
        # NOTE: the file is eric-andrade.webp but the display name is "Erick".
        'name': 'Erick Andrade', 'title': 'Lead RBT',
        'isFounder': False, 'credentials': [],
        'file': 'eric-andrade.webp', 'w': 900, 'h': 1140, 'order': 3,
    },
]


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
    s3.put_object(
        Bucket=bucket, Key=key,
        Body=json.dumps(data, indent=2).encode('utf-8'),
        ContentType='application/json', CacheControl='no-store',
        ServerSideEncryption='AES256',
    )


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return salt, digest.hex()


def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def seed_staff(s3, bucket, force):
    existing = read_json(s3, bucket, K_STAFF, [])
    if existing and not force:
        print(f'  staff.json already has {len(existing)} records — skipping '
              f'(use --force to re-seed).')
        return existing

    records = []
    epoch = int(time.time())
    for entry in STAFF_SEED:
        staff_id = f'st_{secrets.token_hex(4)}'
        src = os.path.join(PUBLIC_DIR, entry['file'])
        photo = None
        if os.path.isfile(src):
            key = f'public/staff/{staff_id}-{epoch}.webp'
            with open(src, 'rb') as fh:
                s3.put_object(
                    Bucket=bucket, Key=key, Body=fh.read(),
                    ContentType='image/webp',
                    CacheControl='public,max-age=31536000,immutable',
                )
            photo = {
                'key': key,
                'url': f'https://{bucket}.s3.amazonaws.com/{key}',
                'w': entry['w'], 'h': entry['h'],
            }
            print(f'  uploaded {entry["file"]} -> {key}')
        else:
            print(f'  WARNING: {src} not found — {entry["name"]} seeded without a photo.')

        records.append({
            'id': staff_id,
            'name': entry['name'],
            'title': entry['title'],
            'isFounder': entry['isFounder'],
            'active': True,
            'order': entry['order'],
            'photo': photo,
            'credentials': entry['credentials'],
            'createdAt': now_iso(),
            'updatedAt': now_iso(),
        })

    write_json(s3, bucket, K_STAFF, records)
    print(f'  wrote {K_STAFF} ({len(records)} records)')
    return records


def seed_owner(s3, bucket, force):
    users = read_json(s3, bucket, K_USERS, [])
    if users and not force:
        print(f'  users.json already has {len(users)} account(s) — refusing to overwrite.')
        print('  Re-run with --force ONLY if you intend to replace every account.')
        return

    print('\n  Create the owner account (no default credentials are ever written).')
    email = input('  Owner email: ').strip().lower()
    if '@' not in email:
        sys.exit('  Not a valid email address.')
    name = input('  Display name: ').strip() or email.split('@')[0]

    password = getpass.getpass('  Password (min 12 chars, not echoed): ')
    if len(password) < MIN_PASSWORD_LEN:
        sys.exit(f'  Password must be at least {MIN_PASSWORD_LEN} characters.')
    if getpass.getpass('  Confirm password: ') != password:
        sys.exit('  Passwords did not match.')

    salt, digest = hash_password(password)
    del password

    write_json(s3, bucket, K_USERS, [{
        'id': f'usr_{secrets.token_hex(4)}',
        'email': email,
        'name': name,
        'role': 'owner',
        'salt': salt,
        'passwordHash': digest,
        'createdAt': now_iso(),
        'lastLoginAt': None,
    }])
    print(f'  wrote {K_USERS} (1 owner account)')


def main():
    parser = argparse.ArgumentParser(description='Seed the CAL-ABA site datastore.')
    parser.add_argument('--force', action='store_true',
                        help='Overwrite existing staff.json / users.json')
    args = parser.parse_args()

    session = boto3.Session(region_name=REGION)
    bucket = stack_bucket(session.client('cloudformation'))
    s3 = session.client('s3')
    print(f'Seeding bucket: {bucket}\n')

    print('Staff:')
    seed_staff(s3, bucket, args.force)

    # Empty collections so the API reads cleanly; testimonials are NEVER seeded.
    for key in (K_REVIEWS, K_APPLICATIONS):
        if read_json(s3, bucket, key, None) is None:
            write_json(s3, bucket, key, [])
            print(f'  initialised {key} (empty)')

    print('\nOwner account:')
    seed_owner(s3, bucket, args.force)

    print('\nDone. Sign in at https://calabatherapy.com/#/admin')


if __name__ == '__main__':
    main()
