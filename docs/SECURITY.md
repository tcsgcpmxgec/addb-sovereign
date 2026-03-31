# ADDB Sovereign Architect: Security Protocols (v1.0.0)

## Overview
The ADDB Sovereign Architect is built on a Zero-Trust security model, ensuring that every request is authenticated and authorized before execution.

---

## 1. Zero-Trust RBAC (Role-Based Access Control)
The system enforces strict RBAC for all system operations.

### Roles:
- **SYSTEM_ADMIN**: Full control over lifecycle, evolution, and security scans.
- **CLOUD_ENGINEER**: Can inspect architecture metadata and trigger deployments.
- **DEVOPS_ENGINEER**: Can view logs and system status.
- **APPROVER**: Can approve or reject pending deployments.

---

## 2. Double-Factor Validation (2FV)
Sensitive endpoints (/api/lifecycle, /api/evolution) require two layers of validation:
1. **JWT Role Verification**: The request must include a valid JWT token with the `SYSTEM_ADMIN` role.
2. **Admin Secret Key**: The request header `x-admin-secret-key` must match the `ADMIN_SECRET_KEY` environment variable.

---

## 3. Intelligent Data Masking (Regex Scrubber)
The WebSocket log stream and daily summaries are processed by a `Regex Scrubber` to prevent accidental data leaks.

### Masking Rules:
- **IPv4/IPv6**: Replaced with `[MASKED_IP]`.
- **Internal Ports**: Replaced with `:[MASKED_PORT]`.
- **API Keys**: Strings matching common key patterns (32+ alphanumeric) are replaced with `[MASKED_KEY]`.

*Note: Data masking is bypassed for users with the `SYSTEM_ADMIN` role.*

---

## 4. Architecture Privacy
Sensitive infrastructure metadata (VPC CIDRs, DB Instance IDs) is hidden by default in the Architecture Map.
- **Default View**: Generic resource names and statuses.
- **Inspect View**: Full technical specs (Requires `Cloud Engineer` or `Admin` role).

---

## 5. Internal Security Leak Detection Scanner
The system includes a proactive scanner that monitors:
- `.env` files for hardcoded secrets.
- `config.yaml` and `package.json` for exposed credentials.
- Build logs for accidental PII leaks.

If a leak is detected, a `CRITICAL_ALERT` is broadcasted to all connected admins.
