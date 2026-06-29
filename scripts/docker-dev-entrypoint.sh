#!/usr/bin/env bash
set -euo pipefail

# Container usually runs as root; required for writable .meteor/local on volumes.
export METEOR_ALLOW_SUPERUSER="${METEOR_ALLOW_SUPERUSER:-1}"
export PYTHONUNBUFFERED=1

# Persistent npm cache (volume) speeds up reinstalls, especially behind the proxy.
export npm_config_cache="${npm_config_cache:-/root/.npm}"

APP_DIR="${APP_SOURCE_FOLDER:-/opt/src}"
BUILD_ROOT="${SSE_BUILD_CACHE:-/var/cache/borovets-sse-meteor-build}"
BUILD_DIR="${BUILD_ROOT}/build"
BUNDLE_DIR="${BUILD_DIR}/bundle"
SERVER_DIR="${BUNDLE_DIR}/programs/server"
BUILD_LOG="${BUILD_ROOT}/meteor-build.log"
SOURCE_FP_FILE="${BUILD_ROOT}/.source-fingerprint"
# Server bundle node_modules are stashed per npm-shrinkwrap hash so a rebuild
# can restore them via hardlinks (seconds) instead of reinstalling (~10 min).
STASH_ROOT="${BUILD_ROOT}/server-node-modules"

cd "$APP_DIR"

HOT_RELOAD="${SSE_HOT_RELOAD:-0}"
FORCE_REBUILD="${SSE_FORCE_REBUILD:-0}"

echo "================================================================"
echo "[dev] entrypoint v8 | SSE_HOT_RELOAD=${HOT_RELOAD} | cache=${BUILD_ROOT}"
if [[ "$HOT_RELOAD" == "1" ]]; then
  echo "[dev] Mode: HOT RELOAD (meteor run) — you will see 'Started proxy.' then a LONG quiet compile."
else
  echo "[dev] Mode: RESTART-ONLY (cached build + stashed server deps) — fast when deps are unchanged."
fi
echo "[dev] App dir: $APP_DIR"
echo "[dev] Settings file: ${SETTINGS_FILE:-settings.json}"
echo "[dev] Force rebuild: SSE_FORCE_REBUILD=${FORCE_REBUILD}"
echo "================================================================"

if [[ ! -d node_modules ]] || [[ -z "$(ls -A node_modules 2>/dev/null)" ]]; then
  echo "[dev] $(date -Iseconds) Installing app npm dependencies..."
  meteor npm install
fi

SETTINGS_FILE="${SETTINGS_FILE:-settings.json}"
if [[ ! -f "$SETTINGS_FILE" ]]; then
  echo "[dev] Settings file not found: $SETTINGS_FILE" >&2
  exit 1
fi

# Node preload mounted/COPY'd outside /opt/src (see compose + Dockerfile.dev).
SETTINGS_LOADER="/usr/local/lib/sse/load-meteor-settings.js"
if [[ ! -f "$SETTINGS_LOADER" ]]; then
  echo "[dev] Settings loader not found: $SETTINGS_LOADER" >&2
  exit 1
fi

compute_source_fingerprint() {
  # ROOT_URL is baked into the server bundle via meteor build --server.
  local root_url="${ROOT_URL:-http://localhost:8500}"
  {
    printf 'ROOT_URL=%s\n' "$root_url"
    local f
    for f in package.json package-lock.json \
             .meteor/packages .meteor/release .meteor/platforms .meteor/versions; do
      [[ -f "$f" ]] && sha256sum "$f"
    done
    local dir
    for dir in client server imports lib public private; do
      [[ -d "$dir" ]] || continue
      find "$dir" -type f -print0 2>/dev/null | LC_ALL=C sort -z | xargs -0 -r sha256sum
    done
  } | sha256sum | awk '{print $1}'
}

compute_npm_fingerprint() {
  # Hash of the server bundle's dependency manifest. Empty if not built yet.
  local server_dir="$1"
  [[ -f "$server_dir/npm-shrinkwrap.json" ]] || { echo ""; return; }
  sha256sum "$server_dir/npm-shrinkwrap.json" "$server_dir/package.json" 2>/dev/null \
    | sha256sum | awk '{print $1}'
}

bundle_npm_ready() {
  local server_dir="$1"
  [[ -d "$server_dir/node_modules" ]] \
    && [[ -n "$(ls -A "$server_dir/node_modules" 2>/dev/null)" ]] \
    && [[ -d "$server_dir/node_modules/fibers" ]]
}

# Restore server node_modules from the per-hash stash (hardlink copy), or run
# npm install and refresh the stash. Same filesystem (single volume) => cp -al
# is near-instant and space-efficient.
ensure_server_node_modules() {
  mkdir -p "$STASH_ROOT"
  local npm_fp
  npm_fp="$(compute_npm_fingerprint "$SERVER_DIR")"
  local stash=""
  [[ -n "$npm_fp" ]] && stash="${STASH_ROOT}/${npm_fp}"

  if [[ -n "$stash" ]] && [[ -d "$stash/node_modules" ]]; then
    echo "[dev] $(date -Iseconds) Restoring server node_modules from cache (deps unchanged)."
    rm -rf "$SERVER_DIR/node_modules"
    cp -al "$stash/node_modules" "$SERVER_DIR/node_modules"
    return
  fi

  echo "[dev] $(date -Iseconds) Installing server bundle dependencies (first time for these deps)..."
  (cd "$SERVER_DIR" && meteor npm install --production)
  echo "[dev] $(date -Iseconds) Server bundle npm install finished."

  if [[ -n "$stash" ]]; then
    echo "[dev] Caching server node_modules for future rebuilds."
    rm -rf "$stash"
    mkdir -p "$stash"
    cp -al "$SERVER_DIR/node_modules" "$stash/node_modules"
  fi
}

run_meteor_dev_server() {
  echo "[dev] $(date -Iseconds) Starting meteor run (first compile may take 15-45 min on a server)..."
  echo "[dev] Tip: use SSE_HOT_RELOAD=0 (default) for cached build + node on restart."
  exec meteor run \
    --settings "$SETTINGS_FILE" \
    --exclude-archs "web.browser.legacy,web.cordova" \
    --port "${PORT:-3000}" \
    "$@"
}

run_build_and_node() {
  mkdir -p "$BUILD_ROOT"
  local source_fp
  source_fp="$(compute_source_fingerprint)"
  local cached_source_fp=""
  [[ -f "$SOURCE_FP_FILE" ]] && cached_source_fp="$(cat "$SOURCE_FP_FILE")"

  local need_build=1

  if [[ "$FORCE_REBUILD" == "1" ]]; then
    echo "[dev] SSE_FORCE_REBUILD=1 — clearing cached bundle (stash kept)."
    rm -rf "$BUILD_DIR"
    rm -f "$SOURCE_FP_FILE"
  elif [[ -f "${BUNDLE_DIR}/main.js" ]] && [[ "$source_fp" == "$cached_source_fp" ]]; then
    need_build=0
    echo "[dev] $(date -Iseconds) Source unchanged — skipping meteor build (cache hit)."
  fi

  if [[ "$need_build" -eq 1 ]]; then
    echo "[dev] $(date -Iseconds) meteor build started (log: $BUILD_LOG)"
    echo "[dev] First build on a server often takes 15-45 minutes with sparse output — this is normal."
    echo "[dev] Settings from $SETTINGS_FILE are loaded at runtime via $SETTINGS_LOADER (meteor build has no --settings flag)."
    rm -rf "$BUILD_DIR"
    : >"$BUILD_LOG"

    set +e
    stdbuf -oL -eL meteor build "$BUILD_DIR" \
      --directory \
      --server-only \
      --server "${ROOT_URL:-http://localhost:8500}" 2>&1 | tee -a "$BUILD_LOG"
    local build_status=${PIPESTATUS[0]}
    set -e

    if [[ "$build_status" -ne 0 ]]; then
      echo "[dev] meteor build failed (exit $build_status). Last 40 lines:" >&2
      tail -n 40 "$BUILD_LOG" >&2
      exit "$build_status"
    fi

    echo "[dev] $(date -Iseconds) meteor build finished."
    # Fresh bundle has no server node_modules: restore from stash or install.
    ensure_server_node_modules
    echo "$source_fp" >"$SOURCE_FP_FILE"
  else
    # Reusing cached bundle; its node_modules should already be present, but
    # guard against a partially-cleared volume.
    if ! bundle_npm_ready "$SERVER_DIR"; then
      echo "[dev] Cached bundle missing server node_modules — restoring."
      ensure_server_node_modules
    else
      echo "[dev] $(date -Iseconds) Server node_modules present — skipping npm (cache hit)."
    fi
  fi

  echo "[dev] $(date -Iseconds) Starting node main.js"
  echo "[dev] After code changes: docker compose -f sse-docker-stack.dev.yml restart app"
  echo "[dev] Full rebuild: SSE_FORCE_REBUILD=1 docker compose -f sse-docker-stack.dev.yml restart app"
  cd "$BUNDLE_DIR"
  local settings_abs="$SETTINGS_FILE"
  [[ "$settings_abs" != /* ]] && settings_abs="$APP_DIR/$settings_abs"
  export SETTINGS_FILE="$settings_abs"
  # SETTINGS_FILE is a short path in env; JSON is read inside Node (no 128 KiB exec limit).
  exec node -r "$SETTINGS_LOADER" main.js
}

if [[ "$HOT_RELOAD" == "1" ]]; then
  run_meteor_dev_server
else
  run_build_and_node
fi
