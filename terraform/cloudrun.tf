resource "google_cloud_run_v2_service" "proxy" {
  name     = var.service_name
  location = var.region

  template {
    service_account = google_service_account.run_sa.email

    scaling {
      min_instance_count = 0 # Scale to zero when idle — no cost when unused
      max_instance_count = 10
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.service_name}/${var.service_name}:${var.image_tag}"

      resources {
        limits   = { cpu = "1", memory = "512Mi" }
        cpu_idle = true # CPU throttled between requests — significantly reduces cost
      }

      # Secrets are injected as env vars at container startup.
      # The app reads process.env.ANTHROPIC_API_KEY / MAPS_API_KEY directly —
      # no Secret Manager SDK call needed at runtime.
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "MAPS_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.maps_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = var.allowed_origins
      }

      env {
        name  = "FEATURE_LIMITS_ENABLED"
        value = "false"
      }

      env {
        name  = "FIRESTORE_PROJECT_ID"
        value = var.project_id
      }

      env {
        name = "GOOGLE_ROUTES_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.routes_key.secret_id
            version = "latest"
          }
        }
      }

      liveness_probe {
        http_get { path = "/health" }
        initial_delay_seconds = 5
        period_seconds        = 30
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_version.anthropic_key,
    google_secret_manager_secret_version.maps_key,
    google_secret_manager_secret_version.routes_key,
  ]
}
