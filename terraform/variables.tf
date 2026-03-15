variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region for all resources"
  default     = "australia-southeast2"
}

variable "service_name" {
  type        = string
  description = "Name used for the Cloud Run service, Artifact Registry repo, and service account"
  default     = "maps-nl-proxy"
}

variable "image_tag" {
  type        = string
  description = "Docker image tag to deploy. Update this to roll out a new build."
  default     = "latest"
}

variable "anthropic_key" {
  type        = string
  description = "Anthropic API key — stored in Secret Manager, never in state plaintext"
  sensitive   = true
}

variable "google_maps_key" {
  type        = string
  description = "Google Maps API key — stored in Secret Manager, never in state plaintext"
  sensitive   = true
}

variable "google_routes_key" {
  type        = string
  description = "Google Routes API key — stored in Secret Manager"
  sensitive   = true
}

variable "allowed_origins" {
  type        = string
  description = "Additional allowed origins for CORS, comma-separated. Frontend Cloud Run URL is included automatically."
  default     = ""
}

variable "frontend_image_tag" {
  type        = string
  description = "Docker image tag for the frontend. Update to roll out a new build."
  default     = "latest"
}

// Set this when domain is confirmed, needed for Prompt 3 CDN
variable "domain_name" {
  type        = string
  description = "Custom domain for the frontend (e.g. foodcrawl.app)"
  default     = ""
}
