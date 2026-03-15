#!/usr/bin/env bash
# Usage: bash deploy.sh [--skip-orphan-check]
#
# Prerequisites before first run:
# 1. Create GCS bucket:
#    gcloud storage buckets create gs://BUCKET_NAME --location=australia-southeast2
# 2. Export PROJECT_ID=your-gcp-project-id
# 3. Export TF_STATE_BUCKET=your-bucket-name
# 4. Ensure gcloud auth application-default login has been run
# 5. Run once manually in /terraform:
#    terraform init -backend-config="bucket=$TF_STATE_BUCKET"
#    (moves existing local state into the GCS bucket)

set -euo pipefail

REGION="australia-southeast2"
REPO_NAME="maps-nl-proxy"

# Track what the pre-flight check found for the summary
PREFLIGHT_FOUND=()
PREFLIGHT_IMPORTED=()
PREFLIGHT_MISSING=()

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

# --- Check required env vars ---
# These are needed for every other check, so validate first.
check_env_vars() {
  local missing=0
  if [ -z "${PROJECT_ID:-}" ]; then
    echo "ERROR: PROJECT_ID is not set."
    missing=1
  fi
  if [ -z "${TF_STATE_BUCKET:-}" ]; then
    echo "ERROR: TF_STATE_BUCKET is not set."
    missing=1
  fi
  if [ "$missing" -eq 1 ]; then
    echo ""
    echo "Export the missing variables and re-run:"
    echo "  export PROJECT_ID=your-gcp-project-id"
    echo "  export TF_STATE_BUCKET=your-bucket-name"
    exit 1
  fi
}

# --- Check required tools are installed and authenticated ---
check_tools() {
  local missing=0

  if ! command -v gcloud &>/dev/null; then
    echo "ERROR: gcloud CLI is not installed."
    echo "  Install: https://cloud.google.com/sdk/docs/install"
    missing=1
  fi

  if ! command -v terraform &>/dev/null; then
    echo "ERROR: terraform is not installed."
    echo "  Install: https://developer.hashicorp.com/terraform/downloads"
    missing=1
  fi

  if ! command -v docker &>/dev/null; then
    echo "ERROR: docker is not installed."
    echo "  Install: https://docs.docker.com/get-docker/"
    missing=1
  fi

  if [ "$missing" -eq 1 ]; then
    exit 1
  fi
}

# --- Helper: check if a resource is already in Terraform state ---
in_tf_state() {
  terraform state list 2>/dev/null | grep -qF "$1"
}

# --- Helper: check if a GCP resource exists ---
# Returns 0 if the resource exists in GCP, 1 if not.
gcp_secret_exists() {
  echo "  Checking: Secret $1..."
  gcloud secrets describe "$1" --project="${PROJECT_ID}" > /dev/null 2>&1
}

gcp_firestore_exists() {
  echo "  Checking: Firestore database $1..."
  gcloud firestore databases describe --database="$1" --project="${PROJECT_ID}" > /dev/null 2>&1
}

gcp_cloudrun_exists() {
  echo "  Checking: Cloud Run service $1..."
  gcloud run services describe "$1" --region="${REGION}" --project="${PROJECT_ID}" > /dev/null 2>&1
}

gcp_artifact_repo_exists() {
  echo "  Checking: Artifact Registry $1..."
  gcloud artifacts repositories describe "$1" --location="${REGION}" --project="${PROJECT_ID}" > /dev/null 2>&1
}

# --- Import a single orphaned resource into Terraform state ---
# Args: $1=terraform resource address, $2=GCP import ID, $3=display name
try_import() {
  local tf_addr="$1"
  local import_id="$2"
  local display_name="$3"

  echo "  Importing ${display_name}..."
  if terraform import "${tf_addr}" "${import_id}" 2>/dev/null; then
    PREFLIGHT_IMPORTED+=("${display_name}")
    echo "  -> Imported successfully."
  else
    echo "  -> WARNING: Import failed for ${display_name}. Terraform apply may recreate it."
    PREFLIGHT_MISSING+=("${display_name} (import failed)")
  fi
}

# --- Check for orphaned GCP resources and import them ---
# An "orphan" is a resource that exists in GCP but is not tracked in
# Terraform state. This happens when resources were created manually,
# by a previous local state that wasn't migrated, or after a state reset.
# Importing them prevents Terraform from erroring with "already exists".
check_orphaned_resources() {
  echo "Checking for orphaned GCP resources..."
  echo ""

  # -- Secret Manager secrets --
  local secrets=(
    "anthropic-api-key:google_secret_manager_secret.anthropic_key"
    "google-maps-api-key:google_secret_manager_secret.maps_key"
    "google-routes-api-key:google_secret_manager_secret.routes_key"
  )
  for entry in "${secrets[@]}"; do
    local secret_id="${entry%%:*}"
    local tf_addr="${entry##*:}"
    if gcp_secret_exists "${secret_id}"; then
      if in_tf_state "${tf_addr}"; then
        PREFLIGHT_FOUND+=("Secret ${secret_id} (in state)")
      else
        PREFLIGHT_FOUND+=("Secret ${secret_id} (ORPHANED)")
        try_import "${tf_addr}" "projects/${PROJECT_ID}/secrets/${secret_id}" "Secret: ${secret_id}"
      fi
    else
      PREFLIGHT_MISSING+=("Secret ${secret_id} (not in GCP — will be created)")
    fi
  done

  # -- Firestore database --
  if gcp_firestore_exists "(default)"; then
    if in_tf_state "google_firestore_database.default"; then
      PREFLIGHT_FOUND+=("Firestore (default) (in state)")
    else
      PREFLIGHT_FOUND+=("Firestore (default) (ORPHANED)")
      try_import \
        "google_firestore_database.default" \
        "projects/${PROJECT_ID}/databases/(default)" \
        "Firestore: (default)"
    fi
  else
    PREFLIGHT_MISSING+=("Firestore (default) (not in GCP — will be created)")
  fi

  # -- Cloud Run services --
  local services=(
    "maps-nl-proxy:google_cloud_run_v2_service.proxy"
    "food-crawl-frontend:google_cloud_run_v2_service.frontend"
  )
  for entry in "${services[@]}"; do
    local svc_name="${entry%%:*}"
    local tf_addr="${entry##*:}"
    if gcp_cloudrun_exists "${svc_name}"; then
      if in_tf_state "${tf_addr}"; then
        PREFLIGHT_FOUND+=("Cloud Run ${svc_name} (in state)")
      else
        PREFLIGHT_FOUND+=("Cloud Run ${svc_name} (ORPHANED)")
        try_import "${tf_addr}" "projects/${PROJECT_ID}/locations/${REGION}/services/${svc_name}" "Cloud Run: ${svc_name}"
      fi
    else
      PREFLIGHT_MISSING+=("Cloud Run ${svc_name} (not in GCP — will be created)")
    fi
  done

  # -- Artifact Registry repository --
  if gcp_artifact_repo_exists "${REPO_NAME}"; then
    if in_tf_state "google_artifact_registry_repository.repo"; then
      PREFLIGHT_FOUND+=("Artifact Registry ${REPO_NAME} (in state)")
    else
      PREFLIGHT_FOUND+=("Artifact Registry ${REPO_NAME} (ORPHANED)")
      try_import \
        "google_artifact_registry_repository.repo" \
        "projects/${PROJECT_ID}/locations/${REGION}/repositories/${REPO_NAME}" \
        "Artifact Registry: ${REPO_NAME}"
    fi
  else
    PREFLIGHT_MISSING+=("Artifact Registry ${REPO_NAME} (not in GCP — will be created)")
  fi
}

# --- Print pre-flight summary and ask for confirmation ---
print_preflight_summary() {
  echo ""
  echo "============================================"
  echo "  PRE-FLIGHT SUMMARY"
  echo "============================================"
  echo ""

  if [ ${#PREFLIGHT_FOUND[@]} -gt 0 ]; then
    echo "Resources found in GCP:"
    for item in "${PREFLIGHT_FOUND[@]}"; do
      echo "  [ok] ${item}"
    done
    echo ""
  fi

  if [ ${#PREFLIGHT_IMPORTED[@]} -gt 0 ]; then
    echo "Resources imported into Terraform state:"
    for item in "${PREFLIGHT_IMPORTED[@]}"; do
      echo "  [+]  ${item}"
    done
    echo ""
  fi

  if [ ${#PREFLIGHT_MISSING[@]} -gt 0 ]; then
    echo "Resources not yet in GCP:"
    for item in "${PREFLIGHT_MISSING[@]}"; do
      echo "  [ ]  ${item}"
    done
    echo ""
  fi

  echo "Project:  ${PROJECT_ID}"
  echo "Region:   ${REGION}"
  echo "Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
  echo ""
  read -r -p "Proceed with build and deploy? [y/N] " confirm
  if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
}

# ============================================================================
# RUN PRE-FLIGHT
# ============================================================================

echo "=== Pre-flight checks ==="
echo ""

check_env_vars
check_tools

# Terraform init must run before we can check state or import
echo "Initialising Terraform..."
cd terraform
terraform init -backend-config="bucket=${TF_STATE_BUCKET}" -input=false >/dev/null 2>&1 || \
  terraform init -backend-config="bucket=${TF_STATE_BUCKET}" -input=false

# Orphan detection uses gcloud commands that hang on Windows/MINGW64.
# Skip with --skip-orphan-check or SKIP_ORPHAN_CHECK=1.
# If skipped and a resource already exists, terraform apply will error
# with "already exists" — run the printed terraform import command to fix.
if [[ "${SKIP_ORPHAN_CHECK:-}" == "1" ]] || [[ " $* " == *" --skip-orphan-check "* ]]; then
  echo "Skipping orphaned resource check."
  echo ""
else
  check_orphaned_resources
fi
print_preflight_summary

# Return to project root for docker builds
cd ..

# ============================================================================
# BUILD & DEPLOY
# ============================================================================

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

# Read image tags from terraform.tfvars so deploy.sh and terraform agree
BACKEND_TAG="$(grep '^image_tag' terraform/terraform.tfvars | sed 's/.*= *"\(.*\)"/\1/')"
FRONTEND_TAG="$(grep '^frontend_image_tag' terraform/terraform.tfvars | sed 's/.*= *"\(.*\)"/\1/' 2>/dev/null || echo "latest")"
BACKEND_TAG="${BACKEND_TAG:-latest}"
FRONTEND_TAG="${FRONTEND_TAG:-latest}"

# --- Build and push backend Docker image ---
echo ""
echo "=== Building backend image (tag: ${BACKEND_TAG}) ==="
docker build -t "${REGISTRY}/${REPO_NAME}:${BACKEND_TAG}" ./cloud-run
docker push "${REGISTRY}/${REPO_NAME}:${BACKEND_TAG}"

# --- Build and push frontend Docker image ---
echo ""
echo "=== Building frontend image (tag: ${FRONTEND_TAG}) ==="
docker build -t "${REGISTRY}/food-crawl-frontend:${FRONTEND_TAG}" ./web
docker push "${REGISTRY}/food-crawl-frontend:${FRONTEND_TAG}"

# --- Terraform apply ---
echo ""
echo "=== Running terraform apply ==="
cd terraform
terraform apply -auto-approve

# --- Update ALLOWED_ORIGINS with the actual frontend URL ---
# On first deploy, the frontend URL isn't known until after apply.
# Read it from terraform output, merge with existing allowed_origins,
# and re-apply so the backend gets the correct CORS config.
FRONTEND_URL="$(terraform output -raw frontend_url)"

# Read current allowed_origins from tfvars
TFVARS_ORIGINS="$(grep '^allowed_origins' terraform.tfvars 2>/dev/null | sed 's/.*= *"\(.*\)"/\1/' || true)"

# Check if frontend URL is already in allowed_origins
if ! echo "${TFVARS_ORIGINS}" | grep -qF "${FRONTEND_URL}"; then
  echo ""
  echo "=== Adding frontend URL to allowed_origins ==="
  if [ -n "${TFVARS_ORIGINS}" ]; then
    NEW_ORIGINS="${FRONTEND_URL},${TFVARS_ORIGINS}"
  else
    NEW_ORIGINS="${FRONTEND_URL}"
  fi
  # Update tfvars
  sed -i "s|^allowed_origins.*|allowed_origins = \"${NEW_ORIGINS}\"|" terraform.tfvars
  # Re-apply to push the updated ALLOWED_ORIGINS to the backend
  terraform apply -auto-approve
fi

# --- Print outputs ---
echo ""
echo "=== Deployment complete ==="
echo "Frontend URL: $(terraform output -raw frontend_url)"
echo "Backend URL:  $(terraform output -raw backend_url)"
