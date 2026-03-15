output "service_url" {
  description = "Cloud Run service URL — copy this into PROXY_BASE in background/service-worker.js and host_permissions in manifest.json"
  value       = google_cloud_run_v2_service.proxy.uri
}

output "artifact_registry_repo" {
  description = "Full Artifact Registry path — use this as the image prefix when running docker push"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.service_name}"
}

output "frontend_url" {
  description = "Cloud Run frontend service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_url" {
  description = "Cloud Run backend service URL"
  value       = google_cloud_run_v2_service.proxy.uri
}

output "firestore_database" {
  description = "Firestore database name"
  value       = google_firestore_database.default.name
}
