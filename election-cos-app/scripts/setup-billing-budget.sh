#!/usr/bin/env bash
# Links the Firebase project to a billing account (Blaze, required for 2nd-gen
# Cloud Functions) and creates the budget alerts from docs/phase-0-infra-plan.md.
# Nothing runs until you supply the billing account id. Needs gcloud signed in as
# a Billing Account Administrator. Safe to re-run: linking is idempotent, and the
# budget is created only if one with the same display name does not exist.
#
#   BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX scripts/setup-billing-budget.sh
#
# Amounts are in the billing account's currency. Use ZAR for a rand account.
set -euo pipefail

PROJECT="${PROJECT:-electioncos1-0}"
CURRENCY="${CURRENCY:-ZAR}"
BUDGET_NAME="${BUDGET_NAME:-ecos-monthly-guard}"
: "${BILLING_ACCOUNT:?Set BILLING_ACCOUNT to the billing account id (gcloud billing accounts list)}"

echo "Linking $PROJECT to billing account $BILLING_ACCOUNT"
gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT"

if gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" \
     --format='value(displayName)' | grep -qx "$BUDGET_NAME"; then
  echo "Budget $BUDGET_NAME already exists; leaving it alone."
  exit 0
fi

# R2,000 ceiling with alerts at 25% (R500), 50%, 90% and 100%.
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="$BUDGET_NAME" \
  --filter-projects="projects/$PROJECT" \
  --budget-amount="2000${CURRENCY}" \
  --threshold-rule=percent=0.25 \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0
echo "Budget created. Alerts go to billing account administrators by default."
