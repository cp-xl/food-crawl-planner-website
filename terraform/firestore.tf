resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Change to RETAIN before production
  deletion_policy = "DELETE"

  depends_on = [google_project_service.firestore]
}
