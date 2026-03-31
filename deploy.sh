#!/bin/bash

# ADDB Deployment Script for GCP Cloud Shell
# This script automates the provisioning of GCP infrastructure and deployment of the ADDB bot.

set -e

# Configuration
PROJECT_ID="mexico-gec"
REGION="us-central1"
APP_NAME="addb"
REPO_NAME="addb-repo"
IMAGE_NAME="addb-bot"

echo "----------------------------------------------------------"
echo "🚀 Starting ADDB Deployment to GCP Project: $PROJECT_ID"
echo "----------------------------------------------------------"

# 1. Set the active GCP project
echo "📍 Setting active GCP project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 2. Enable essential APIs (Bootstrap)
echo "🔌 Enabling essential APIs..."
gcloud services enable \
    serviceusage.googleapis.com \
    cloudresourcemanager.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    firestore.googleapis.com \
    iam.googleapis.com

# 3. Provision Infrastructure with Terraform
echo "🏗️ Initializing and applying Terraform infrastructure..."
cd infrastructure/terraform
terraform init
terraform apply -auto-approve \
    -var="project_id=$PROJECT_ID" \
    -var="region=$REGION" \
    -var="app_name=$APP_NAME"
cd ../..

# 4. Build and Push Docker Image using Cloud Build
echo "📦 Building and pushing Docker image to Artifact Registry..."
# Get the Artifact Registry repository path from Terraform output or construct it
# Constructing it based on the expected path in main.tf
AR_REPO_PATH="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:latest"

gcloud builds submit --tag "$AR_REPO_PATH" .

# 5. Deploy to Cloud Run
echo "🚀 Deploying ADDB Bot to Cloud Run..."
gcloud run deploy "$APP_NAME-bot" \
    --image "$AR_REPO_PATH" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --service-account "$APP_NAME-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,NODE_ENV=production"

echo "----------------------------------------------------------"
echo "✅ ADDB Deployment Complete!"
echo "----------------------------------------------------------"
echo "Your bot should be accessible at the Cloud Run URL provided above."
echo "----------------------------------------------------------"
