#!/usr/bin/env bash
set -euo pipefail
# Run with APP_DIR, RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE in the environment.
# Restic storage must be outside this droplet (e.g. an S3 bucket or another host).
: "${APP_DIR:?Set APP_DIR to the checkout directory}"
: "${RESTIC_REPOSITORY:?Set an off-droplet restic repository}"
: "${RESTIC_PASSWORD_FILE:?Set the restic password file}"
cd "$APP_DIR"
backup_name="maths-$(date -u +%Y%m%dT%H%M%SZ).sqlite3"
docker compose exec -T app node scripts/admin.js backup "/data/backups/$backup_name"
restic backup "data/backups/$backup_name" --tag mental-maths
# Keep all copies in this initial version. Add retention after verifying recovery.
printf 'Off-site backup completed: %s\n' "$backup_name"
