terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }

  # GCS remote state backend — bucket name is passed via -backend-config at init time.
  # Create this bucket manually before running terraform init:
  #   gcloud storage buckets create gs://BUCKET_NAME --location=australia-southeast2
  # Then init with:
  #   terraform init -backend-config="bucket=BUCKET_NAME"
  backend "gcs" {
    prefix = "food-crawl/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable all required GCP APIs before any resources are created.
# Each resource implicitly depends on the relevant service being enabled.
resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "routes" {
  service            = "routes.googleapis.com"
  disable_on_destroy = false
}

# Docker image repository — images are pushed here before Cloud Run pulls them
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.service_name
  format        = "DOCKER"
  depends_on    = [google_project_service.artifactregistry]
}
