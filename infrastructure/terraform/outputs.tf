output "bot_url" {
  description = "The URL of the deployed ADDB Sovereign Bot"
  value       = google_cloud_run_v2_service.bot_service.uri
}

output "artifact_registry_repo" {
  description = "The Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}

output "service_account_email" {
  description = "The email of the bot's service account"
  value       = google_service_account.bot_sa.email
}
