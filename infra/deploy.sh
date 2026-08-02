#!/bin/bash
# CAL-ABA site API deployment
#   ./deploy.sh setup   - create/update the CloudFormation stack, then ship code
#   ./deploy.sh code    - update the Lambda code only
#   ./deploy.sh status  - stack status + outputs (API URL)
#
# The JWT secret is generated inside a short-lived python process and handed to
# CloudFormation as a NoEcho parameter via a 0600 temp file that is deleted on
# exit. It is never printed, never placed in argv, never committed.

set -euo pipefail
cd "$(dirname "$0")"
SELF="$(basename "$0")"

STACK_NAME="calaba-site-api"
FUNCTION_NAME="calaba-site-api"
REGION="us-east-1"
BUCKET_NAME="calabatherapy-site"

# ── Parameter file plumbing ───────────────────────────────────────────────
# CloudFormation parameters (one of which is the JWT secret) are written to a
# 0600 temp file rather than passed on the command line, where they would be
# visible to every process on the box via /proc/<pid>/cmdline.
PARAMS_FILE=""

clear_params_file() {
  if [ -n "$PARAMS_FILE" ]; then
    rm -f "$PARAMS_FILE"
    PARAMS_FILE=""
  fi
  return 0
}
trap clear_params_file EXIT INT TERM

# write_params_file KEY=VALUE...   (never pass a secret here — argv is public)
# Set GEN_JWT=1 to have a fresh JwtSecret generated INSIDE the python process,
# so the secret exists only in that process and in the 0600 file.
write_params_file() {
  PARAMS_FILE="$(mktemp "${TMPDIR:-/tmp}/calaba-params.XXXXXXXX.json")"
  chmod 600 "$PARAMS_FILE"
  GEN_JWT="${GEN_JWT:-0}" python3 - "$@" >"$PARAMS_FILE" <<'PYEOF'
import json, os, secrets, sys
params = [
    {"ParameterKey": k, "ParameterValue": v}
    for k, v in (a.split("=", 1) for a in sys.argv[1:])
]
if os.environ.get("GEN_JWT") == "1":
    params.insert(0, {"ParameterKey": "JwtSecret",
                      "ParameterValue": secrets.token_urlsafe(48)})
print(json.dumps(params))
PYEOF
}

case "${1:-help}" in

  setup)
    echo "=== Deploying CloudFormation stack: $STACK_NAME ==="

    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
         >/dev/null 2>&1; then
      echo "Stack exists — reusing the existing JWT secret (UsePreviousValue)."
      aws cloudformation deploy \
        --template-file template.yaml \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --capabilities CAPABILITY_NAMED_IAM \
        --no-fail-on-empty-changeset \
        --parameter-overrides \
          BucketName="$BUCKET_NAME" \
          SesFromAddress="noreply@calabatherapy.com" \
          SesIdentityDomain="calabatherapy.com" \
          NotifyEmail="admin@calabatherapy.com" \
          SiteUrl="https://calabatherapy.com"
    else
      echo "New stack — generating a random JWT secret (not displayed)."
      # The secret goes to CloudFormation through a 0600 file, never through
      # argv: argv is world-readable in /proc and lands in shell history.
      GEN_JWT=1 write_params_file \
        "BucketName=$BUCKET_NAME" \
        "SesFromAddress=noreply@calabatherapy.com" \
        "SesIdentityDomain=calabatherapy.com" \
        "NotifyEmail=admin@calabatherapy.com" \
        "SiteUrl=https://calabatherapy.com"
      aws cloudformation deploy \
        --template-file template.yaml \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --capabilities CAPABILITY_NAMED_IAM \
        --no-fail-on-empty-changeset \
        --parameter-overrides "file://$PARAMS_FILE"
      clear_params_file
    fi

    echo ""
    echo "=== Stack ready. Shipping Lambda code... ==="
    bash "$SELF" code

    echo ""
    bash "$SELF" status
    ;;

  code)
    echo "Packaging lambda_function.py..."
    rm -f lambda_deploy.zip
    zip -j -q lambda_deploy.zip lambda_function.py

    echo "Updating $FUNCTION_NAME..."
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://lambda_deploy.zip" \
      --region "$REGION" \
      --no-cli-pager \
      --query '{Function:FunctionName,CodeSize:CodeSize,LastModified:LastModified}' \
      --output table

    aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
    rm -f lambda_deploy.zip
    echo "Code deployed."
    ;;

  rotate-jwt)
    # Invalidates every issued token — everyone must sign in again.
    echo "=== Rotating the JWT signing secret ==="
    read -r -p "This signs out every admin session. Continue? [y/N] " confirm
    [ "$confirm" = "y" ] || { echo "Aborted."; exit 1; }
    GEN_JWT=1 write_params_file "BucketName=$BUCKET_NAME"
    aws cloudformation deploy \
      --template-file template.yaml \
      --stack-name "$STACK_NAME" \
      --region "$REGION" \
      --capabilities CAPABILITY_NAMED_IAM \
      --no-fail-on-empty-changeset \
      --parameter-overrides "file://$PARAMS_FILE"
    clear_params_file

    # A stack-only update replaces the Lambda's env var but leaves whatever
    # code object is currently attached; re-ship so the running function is
    # unambiguously the code in this directory signing with the new secret.
    echo ""
    echo "=== Re-shipping Lambda code against the new secret... ==="
    bash "$SELF" code
    echo "Rotated. All sessions invalidated."
    ;;

  status)
    echo "=== $STACK_NAME ==="
    aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$REGION" \
      --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}' \
      --output table \
      --no-cli-pager 2>/dev/null || echo "Stack not found. Run './deploy.sh setup' first."
    ;;

  *)
    echo "CAL-ABA site API deploy"
    echo "  ./deploy.sh setup       Create/update infrastructure, then ship code"
    echo "  ./deploy.sh code        Update Lambda code only"
    echo "  ./deploy.sh status      Show stack status and the API URL"
    echo "  ./deploy.sh rotate-jwt  Rotate the signing secret (signs everyone out)"
    ;;

esac
