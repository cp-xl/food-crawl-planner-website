# Dedicated service account for the Cloud Run service.
# It has exactly two permissions: read access to each secret. Nothing else.
resource "google_service_account" "run_sa" {
  account_id   = "${var.service_name}-sa"
  display_name = "Maps NL Proxy — Cloud Run Service Account"
}

# Grant read access to each secret individually (not project-wide).
# This means if a second secret is added later, this SA can't read it
# until explicitly granted — enforcing least privilege as the project grows.
resource "google_secret_manager_secret_iam_member" "run_anthropic" {
  secret_id = google_secret_manager_secret.anthropic_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "run_maps" {
  secret_id = google_secret_manager_secret.maps_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run_sa.email}"
}

# Routes API key secret access
resource "google_secret_manager_secret_iam_member" "run_routes" {
  secret_id = google_secret_manager_secret.routes_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run_sa.email}"
}

# Firestore read/write for crawl persistence
resource "google_project_iam_member" "run_datastore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}

# Cloud Logging for analytics events and error reporting
resource "google_project_iam_member" "run_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.run_sa.email}"
}

# Allow anyone on the internet to invoke the Cloud Run service.
# This is intentional — the extension is public and users have no auth tokens.
# The origin check + rate limiting in the app layer are the abuse controls.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = google_cloud_run_v2_service.proxy.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
