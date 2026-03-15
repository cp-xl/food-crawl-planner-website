resource "google_service_account" "frontend_sa" {
  account_id   = "food-crawl-frontend-sa"
  display_name = "Food Crawl Frontend — Cloud Run Service Account"
}

resource "google_cloud_run_v2_service" "frontend" {
  name     = "food-crawl-frontend"
  location = var.region

  template {
    service_account = google_service_account.frontend_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.service_name}/food-crawl-frontend:${var.frontend_image_tag}"

      resources {
        limits   = { cpu = "1", memory = "512Mi" }
        cpu_idle = true
      }

      env {
        name  = "NEXT_PUBLIC_PROXY_URL"
        value = google_cloud_run_v2_service.proxy.uri
      }

      env {
        name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.maps_key.secret_id
            version = "latest"
          }
        }
      }

      ports {
        container_port = 3080
      }

      liveness_probe {
        http_get { path = "/" }
        initial_delay_seconds = 10
        period_seconds        = 30
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_version.maps_key,
  ]
}

# Public access — the frontend is a public website
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  name     = google_cloud_run_v2_service.frontend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Frontend SA needs secret access for the Maps API key
resource "google_secret_manager_secret_iam_member" "frontend_maps" {
  secret_id = google_secret_manager_secret.maps_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.frontend_sa.email}"
}
