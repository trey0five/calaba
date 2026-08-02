# CAL-ABA site API — operator guide

Backend for the admin dashboard at <https://calabatherapy.com/#/admin> and for the
public site's live testimonials / team data.

| | |
|---|---|
| CloudFormation stack | `calaba-site-api` |
| Region | `us-east-1` |
| API URL | `https://5h4kz9dvqa.execute-api.us-east-1.amazonaws.com` |
| Lambda | `calaba-site-api` (python3.12, 256 MB, 30 s) |
| Bucket | `calabatherapy-site` |
| Logs | CloudWatch `/aws/lambda/calaba-site-api` (90-day retention) |

The public website **never depends on this API being up**. Every public fetch has a
short timeout and falls back to the testimonials/staff bundled into the repo.

---

## Deploy

```bash
bash infra/deploy.sh setup    # create/update infrastructure, then ship code
bash infra/deploy.sh code     # ship code only (the everyday command)
bash infra/deploy.sh status   # stack status + API URL
```

`setup` generates the JWT signing secret itself with
`python3 -c "import secrets;print(secrets.token_urlsafe(48))"` and passes it straight
to CloudFormation as a `NoEcho` parameter. It is never printed, never written to
disk, and never committed. Re-running `setup` on an existing stack reuses the
stored secret rather than generating a new one.

## Seed (first run only)

```bash
python3 infra/seed.py           # staff records + photo uploads + owner account
python3 infra/seed.py --force   # re-seed, overwriting staff.json / users.json
```

Writes the four staff records with their photos from `public/*.webp`, then prompts
for the owner email and password (`getpass` — never echoed). There are **no default
credentials**. It refuses to overwrite an existing `users.json` without `--force`.

Testimonials are deliberately **not** seeded. `reviews.json` starts empty so the
bundled sample testimonials keep showing on the site until a real review is
approved in the dashboard.

## Change the admin password

From the dashboard (Settings → change password), or via the API:

```bash
curl -X POST "$API/api/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"…","newPassword":"…"}'    # min 12 chars
```

Passwords are PBKDF2-SHA256, 210 000 iterations, 16-byte per-user salt, compared
with `hmac.compare_digest`. Sessions are 12-hour HS256 JWTs.

To add or remove additional accounts, use `GET/POST /api/admin/users` and
`DELETE /api/admin/users/{id}` — owner role only; the last owner cannot be deleted.

## Rotate the signing secret

```bash
bash infra/deploy.sh rotate-jwt   # signs every admin session out immediately
```

Do this if a laptop with an active session is lost.

---

## Where the data lives

Everything is plain JSON in S3 — no database. Read it with `aws s3 cp` if you ever
need to inspect or hand-edit it.

```
s3://calabatherapy-site/
  public/staff/{staffId}-{epoch}.webp    # public-read, immutable 1-year cache
  private/data/reviews.json
  private/data/staff.json
  private/data/applications.json
  private/data/auth/users.json           # salted password hashes only
  private/data/auth/ratelimit.json       # lockout + per-IP sliding windows
  private/resumes/{applicationId}/{file} # private; opened via a fresh 1-hour link
  private/resumes/incoming/{uploadId}/   # upload staging, auto-deleted after 7 days
```

Only the `public/` prefix is world-readable, via a bucket policy scoped to
`public/*`. Everything under `private/` is reachable only through the Lambda role.
Versioning is on (noncurrent versions expire after 90 days), so an accidental
overwrite of a JSON file is recoverable:

```bash
aws s3api list-object-versions --bucket calabatherapy-site \
  --prefix private/data/reviews.json --region us-east-1
```

## Email

Notifications are sent with SES from `noreply@calabatherapy.com` to
`admin@calabatherapy.com`, with the submitter's address as `Reply-To`. Reviews
without publication consent get a `[PRIVATE FEEDBACK]` subject prefix.

**The record is always written to S3 before the email is attempted.** If SES fails
the error is logged and the request still returns success, so a submission is never
lost — the dashboard, not the inbox, is the source of truth. Résumés are never
attached or linked in email; the message links to the dashboard instead.

## Safety rails built into the API

- **Consent gate** — a review can only be approved if `submission.consent === true`;
  the public testimonials endpoint additionally re-checks consent on every read.
- **Spam** — hidden `company` honeypot and a `formOpenedAt` timing check both drop
  silently with a normal-looking 200. Per-IP sliding windows: reviews 5/h,
  applications 3/h, upload URLs 5/h.
- **Login lockout** — 5 failures per (IP, email) within 15 minutes locks that pair
  out for 15 minutes; a successful login clears it.
- **Caps** — 64 KB JSON bodies, 500-character strings (2 000 for review text and
  references), 2 MB staff photos, 5 MB résumés enforced by the S3 upload policy.

## Troubleshooting

```bash
aws logs tail /aws/lambda/calaba-site-api --follow --region us-east-1
```

- `401` on every admin call → the 12-hour token expired; sign in again.
- `429` on login → lockout; wait 15 minutes or clear the entry in `ratelimit.json`.
- Emails not arriving → check the `[ses]` lines in the log. Submissions are still
  safe in the dashboard regardless.
