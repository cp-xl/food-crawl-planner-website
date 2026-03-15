# Each secret is created first, then a version is added containing the actual value.
# Separating them means you can rotate a key by adding a new version without
# touching the secret resource itself — Terraform won't try to recreate anything.

resource "google_secret_manager_secret" "anthropic_key" {
  secret_id = "anthropic-api-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "anthropic_key" {
  secret      = google_secret_manager_secret.anthropic_key.id
  secret_data = var.anthropic_key
}

resource "google_secret_manager_secret" "maps_key" {
  secret_id = "google-maps-api-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "maps_key" {
  secret      = google_secret_manager_secret.maps_key.id
  secret_data = var.google_maps_key
}

resource "google_secret_manager_secret" "routes_key" {
  secret_id = "google-routes-api-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "routes_key" {
  secret      = google_secret_manager_secret.routes_key.id
  secret_data = var.google_routes_key
}
