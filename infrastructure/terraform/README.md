# ADDB Sovereign Bot Infrastructure Provisioning

This directory contains Terraform scripts to provision the necessary Google Cloud Platform (GCP) infrastructure to host and run the ADDB Sovereign Bot in a production-like environment.

## Prerequisites

-   [Terraform](https://www.terraform.io/downloads.html) installed locally.
-   [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
-   A GCP Project created.

## Resources Provisioned

-   **APIs Enabled**: Cloud Run, Cloud Build, Artifact Registry, Firestore, Compute, GKE, Pub/Sub, Cloud SQL, Storage, IAM, Service Usage, Resource Manager.
-   **Service Account**: A dedicated service account for the bot with necessary IAM roles (`roles/run.admin`, `roles/compute.admin`, etc.).
-   **Artifact Registry**: A Docker repository to store the bot's container image.
-   **Firestore Database**: A native mode Firestore database for persistence.
-   **Cloud Run Service**: A managed service to host the bot's container.

## How to Use

1.  **Initialize Terraform**:
    ```bash
    terraform init
    ```

2.  **Create a `terraform.tfvars` file**:
    Create a file named `terraform.tfvars` and provide your project details:
    ```hcl
    project_id = "your-gcp-project-id"
    region     = "us-central1"
    app_name   = "addb-sovereign-bot"
    ```

3.  **Plan the infrastructure**:
    ```bash
    terraform plan
    ```

4.  **Apply the changes**:
    ```bash
    terraform apply
    ```

5.  **Build and Push the Bot Image**:
    Once the infrastructure is provisioned, you need to build and push the bot's Docker image to the Artifact Registry:
    ```bash
    # Replace variables with your values
    PROJECT_ID="your-gcp-project-id"
    REGION="us-central1"
    REPO_NAME="addb-sovereign-bot"
    IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/bot:latest"

    # Build the image (from the root of the project)
    docker build -t ${IMAGE_TAG} .

    # Authenticate Docker to GCP
    gcloud auth configure-docker ${REGION}-docker.pkg.dev

    # Push the image
    docker push ${IMAGE_TAG}
    ```

6.  **Redeploy Cloud Run**:
    After pushing the image, you can trigger a redeploy of the Cloud Run service via Terraform or the GCP Console.

## Security Note

The provided Terraform script grants the bot's service account broad permissions (e.g., `roles/compute.admin`, `roles/container.admin`) to allow it to manage infrastructure as a "Sovereign" bot. In a production environment, you should follow the principle of least privilege and refine these roles based on the specific actions the bot needs to perform.
