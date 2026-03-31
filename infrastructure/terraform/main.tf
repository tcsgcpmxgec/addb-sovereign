terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
locals {
  services = [
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "pubsub.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com"
  ]
}

resource "google_project_service" "services" {
  for_each = toset(local.services)
  project  = var.project_id
  service  = each.value

  disable_on_destroy = false
}

# Service Account for the Bot
resource "google_service_account" "bot_sa" {
  account_id   = "${var.app_name}-sa"
  display_name = "ADDB Sovereign Bot Service Account"
  depends_on   = [google_project_service.services]
}

# IAM Roles for the Bot (Sovereign permissions)
locals {
  bot_roles = [
    "roles/run.admin",
    "roles/artifactregistry.reader",
    "roles/storage.admin",
    "roles/compute.admin",
    "roles/container.admin",
    "roles/cloudbuild.builds.editor",
    "roles/datastore.user",
    "roles/cloudsql.admin",
    "roles/pubsub.admin",
    "roles/iam.serviceAccountUser",
    "roles/serviceusage.serviceUsageAdmin"
  ]
}

resource "google_project_iam_member" "bot_iam" {
  for_each = toset(local.bot_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.bot_sa.email}"
}

# Artifact Registry for Bot Images
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.app_name
  description   = "Docker repository for ADDB Sovereign Bot"
  format        = "DOCKER"
  depends_on    = [google_project_service.services]
}

# Firestore Database (Native Mode)
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  
  # Ensure Firestore is enabled before creating the database
  depends_on = [google_project_service.services]
}

# Cloud Run Service for the Bot
# Note: This assumes the image is already built and pushed to the registry.
# In a real scenario, you'd push the image first.
resource "google_cloud_run_v2_service" "bot_service" {
  name     = var.app_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.bot_sa.email
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/bot:latest"
      
      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      
      # Add other environment variables as needed
      # env {
      #   name  = "GEMINI_API_KEY"
      #   value = "YOUR_API_KEY"
      # }
    }
  }

  depends_on = [
    google_project_iam_member.bot_iam,
    google_artifact_registry_repository.repo
  ]
}

# Allow unauthenticated access (Optional, for public bot access)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.bot_service.name
  location = google_cloud_run_v2_service.bot_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
