#!/usr/bin/env bash
set -euo pipefail

# Backup dev MongoDB and sse-internal from running Docker containers.
# Safe to run while the stack is up (read-only operations inside containers).
#
# Usage (from repo root):
#   ./scripts/backup-dev-data.sh
#
# Optional env overrides:
#   BACKUP_ROOT=backups
#   MONGO_CONTAINER=borovets-sse-mongo-dev
#   APP_CONTAINER=borovets-sse-app-dev
#   MONGO_DB=meteor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_ROOT="${BACKUP_ROOT:-$REPO_ROOT/backups}"
MONGO_CONTAINER="${MONGO_CONTAINER:-borovets-sse-mongo-dev}"
APP_CONTAINER="${APP_CONTAINER:-borovets-sse-app-dev}"
MONGO_DB="${MONGO_DB:-meteor}"

MONGO_ARCHIVE_NAME="mongo-${MONGO_DB}.archive.gz"
SSE_INTERNAL_ARCHIVE_NAME="sse-internal.tar.gz"

require_container() {
  local name="$1"
  if ! docker inspect "$name" >/dev/null 2>&1; then
    echo "Error: container '$name' not found. Is the dev stack running?" >&2
    exit 1
  fi
  if [[ "$(docker inspect -f '{{.State.Running}}' "$name")" != "true" ]]; then
    echo "Error: container '$name' is not running." >&2
    exit 1
  fi
}

cleanup_container_file() {
  local container="$1"
  local path="$2"
  docker exec "$container" rm -f "$path" >/dev/null 2>&1 || true
}

require_container "$MONGO_CONTAINER"
require_container "$APP_CONTAINER"

BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

MONGO_TMP="/tmp/${MONGO_ARCHIVE_NAME}"
SSE_TMP="/tmp/${SSE_INTERNAL_ARCHIVE_NAME}"

echo "Backup dir: $BACKUP_DIR"
echo "=== MongoDB (mongodump from $MONGO_CONTAINER) ==="
docker exec "$MONGO_CONTAINER" mongodump \
  --db "$MONGO_DB" \
  --archive="$MONGO_TMP" \
  --gzip
docker cp "$MONGO_CONTAINER:$MONGO_TMP" "$BACKUP_DIR/$MONGO_ARCHIVE_NAME"
cleanup_container_file "$MONGO_CONTAINER" "$MONGO_TMP"

echo "=== sse-internal (from $APP_CONTAINER) ==="
docker exec "$APP_CONTAINER" tar czf "$SSE_TMP" -C /root sse-internal
docker cp "$APP_CONTAINER:$SSE_TMP" "$BACKUP_DIR/$SSE_INTERNAL_ARCHIVE_NAME"
cleanup_container_file "$APP_CONTAINER" "$SSE_TMP"

cat > "$BACKUP_DIR/README.txt" <<EOF
Backup created: $(date -Iseconds)
Source stack: sse-docker-stack.dev.yml (borovets-sse-dev)

Contents:
  ${MONGO_ARCHIVE_NAME}  - mongodump of DB '${MONGO_DB}' from ${MONGO_CONTAINER} (/data/db volume)
  ${SSE_INTERNAL_ARCHIVE_NAME}      - /root/sse-internal from ${APP_CONTAINER}

Restore mongo:
  docker cp ${MONGO_ARCHIVE_NAME} ${MONGO_CONTAINER}:/tmp/
  docker exec ${MONGO_CONTAINER} mongorestore --drop --gzip --archive=/tmp/${MONGO_ARCHIVE_NAME} --nsInclude=${MONGO_DB}.*

Restore sse-internal:
  tar xzf ${SSE_INTERNAL_ARCHIVE_NAME} -C /path/to/sse-internal-local
EOF

echo "=== Done ==="
ls -lh "$BACKUP_DIR"
du -sh "$BACKUP_DIR"
