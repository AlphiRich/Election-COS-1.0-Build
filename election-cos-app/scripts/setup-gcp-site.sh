#!/usr/bin/env bash
# One-time Google Cloud setup so GitHub Actions can deploy the PUBLIC SITE
# (dist-site) to Cloud Run. Run it once, in Cloud Shell or anywhere gcloud is
# signed in as a project Owner:
#
#   bash election-cos-app/scripts/setup-gcp-site.sh
#
# What it creates (all idempotent; re-running changes nothing that exists):
#   - APIs: Cloud Run, Artifact Registry, IAM, IAM Credentials, STS
#   - Artifact Registry Docker repo  `ecos` in africa-south1
#   - Service account `ecos-site-deployer`  (what GitHub Actions acts as)
#   - Service account `ecos-site-runtime`   (what the container runs as; no roles)
#   - Workload Identity pool `github` + provider `github-oidc`, restricted to
#     this one repository, so GitHub signs in WITHOUT a stored key.
#   - A SECOND Firebase Hosting site, `electioncos-site`, which fronts the
#     Cloud Run service and is where electioncos.co.za is connected.
#
# What it does NOT touch: the application's Hosting site (electioncos1-0,
# target `app`), Firestore, Functions, or billing. Cloud Run needs billing
# linked; the script checks and stops if it is not.
set -euo pipefail

PROJECT="${PROJECT:-electioncos1-0}"
REGION="${REGION:-africa-south1}"   # image repository location
RUN_REGION="${RUN_REGION:-europe-west1}"   # Cloud Run service location (Firebase front needs a supported region)
AR_REPO="${AR_REPO:-ecos}"
GITHUB_REPO="${GITHUB_REPO:-AlphiRich/Election-COS-1.0-Build}"
POOL="${POOL:-github}"
PROVIDER="${PROVIDER:-github-oidc}"
SITE_ID="${SITE_ID:-electioncos-site}"
DEPLOYER="ecos-site-deployer"
RUNTIME="ecos-site-runtime"
DEPLOYER_EMAIL="$DEPLOYER@$PROJECT.iam.gserviceaccount.com"
RUNTIME_EMAIL="$RUNTIME@$PROJECT.iam.gserviceaccount.com"

say() { printf '\n== %s\n' "$*"; }

say "Project $PROJECT"
gcloud config set project "$PROJECT" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"

say "Checking billing is linked (Cloud Run requires it)"
if [ "$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')" != "True" ]; then
  echo "Billing is not linked to $PROJECT. Link it first:"
  echo "  BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX bash election-cos-app/scripts/setup-billing-budget.sh"
  exit 1
fi

say "Enabling APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  firebasehosting.googleapis.com

say "Artifact Registry repo $AR_REPO ($REGION)"
gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$AR_REPO" --repository-format=docker \
       --location="$REGION" --description="Election Campaign OS container images"

say "Service accounts"
for sa in "$DEPLOYER" "$RUNTIME"; do
  gcloud iam service-accounts describe "$sa@$PROJECT.iam.gserviceaccount.com" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$sa" --display-name="$sa"
done

say "Deployer roles (Cloud Run deploy, push images, run as the runtime account)"
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None \
  --member="serviceAccount:$DEPLOYER_EMAIL" --role=roles/run.admin >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location="$REGION" \
  --member="serviceAccount:$DEPLOYER_EMAIL" --role=roles/artifactregistry.writer >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_EMAIL" \
  --member="serviceAccount:$DEPLOYER_EMAIL" --role=roles/iam.serviceAccountUser >/dev/null
# Hosting releases for the site that fronts Cloud Run. Project-level because
# Firebase Hosting has no per-site IAM; the deploy workflow only ever names
# site-hosting/firebase/firebase.json, which can only target $SITE_ID.
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None \
  --member="serviceAccount:$DEPLOYER_EMAIL" --role=roles/firebasehosting.admin >/dev/null

say "Firebase Hosting site $SITE_ID (separate from the application's site)"
TOKEN="$(gcloud auth print-access-token)"
code="$(curl -s -o /tmp/site-create.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
  -H "Content-Type: application/json" -d '{}' \
  "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT/sites?siteId=$SITE_ID")"
case "$code" in
  200) echo "Created $SITE_ID ($SITE_ID.web.app)" ;;
  409) echo "$SITE_ID already exists in a project; checking it is this one"
       curl -sf -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
         "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT/sites/$SITE_ID" >/dev/null \
         || { echo "Site id $SITE_ID is taken by another project. Pick another, set SITE_ID, and change \"site\" in site-hosting/firebase/firebase.json to match."; exit 1; } ;;
  *)   echo "Creating the Hosting site failed (HTTP $code):"; cat /tmp/site-create.json; exit 1 ;;
esac

say "Workload Identity Federation (keyless GitHub sign-in)"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --location=global \
       --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
       --workload-identity-pool="$POOL" --display-name="GitHub OIDC" \
       --issuer-uri="https://token.actions.githubusercontent.com" \
       --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
       --attribute-condition="assertion.repository=='$GITHUB_REPO'"

# Only this repository may act as the deployer.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_EMAIL" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" >/dev/null

say "Done"
cat <<EOF
The deploy workflow already defaults to these values; nothing to copy unless
you changed a name above:
  GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER
  GCP_SITE_DEPLOYER = $DEPLOYER_EMAIL

Next: GitHub -> Actions -> "Deploy public site (Cloud Run)" -> Run workflow.
IAM changes can take a minute or two to apply; if the first run fails at
"Sign in to Google Cloud", run it again.

Then connect the domain: Firebase console -> Hosting -> $SITE_ID ->
Add custom domain -> electioncos.co.za. Add the records it shows in
Cloudflare DNS as "DNS only" (grey cloud) until the certificate is issued.
EOF
