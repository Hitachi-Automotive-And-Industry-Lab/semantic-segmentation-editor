# Docker development workflow

Docker resources use the **`borovets`** prefix (images, containers, volumes). App URL: **http://localhost:8500**.

Use **`sse-docker-stack.dev.yml`** when changing application code (`imports/`, `client/`, `server/`, etc.). You do **not** need `docker compose build` after every JS/JSX edit — only **restart the app container**.

Use **`sse-docker-stack.yml`** (production Dockerfile) for a deploy-like image smoke test.

## Quick start

```bash
# Once (or after package.json / Dockerfile.dev changes)
docker compose -f sse-docker-stack.dev.yml build

# Run (same data volumes as production compose)
SETTINGS_FILE=room_labels_new.json docker compose -f sse-docker-stack.dev.yml up
```

Open http://localhost:8500

## Settings and data paths

In Docker, set explicit folders in your settings JSON (empty `images-folder` uses container `$HOME`, which is easy to get wrong):

```json
"configuration": {
  "images-folder": "/root/sse-images",
  "internal-folder": "/root/sse-internal",
  "demo-mode": false
}
```

Volumes (same as production):

| Variable | Default | Mount point in container |
|----------|---------|-------------------------|
| `SSE_IMAGES` | `./pcd_samples` | `/root/sse-images` |
| `SSE_INTERNAL` | `./sse-internal-local` | `/root/sse-internal` |

## What reloads when (default mode)

By default **`SSE_HOT_RELOAD=0`**: the entrypoint runs `meteor build` once, then `node main.js`. **Saving files does not update the site** until you restart the container.

| Change | Action |
|--------|--------|
| `.js` / `.jsx` / `.less` / most app files | `docker compose -f sse-docker-stack.dev.yml restart app` |
| `package.json`, `package-lock.json` | `docker compose -f sse-docker-stack.dev.yml exec app meteor npm install` then `restart app` |
| `.meteor/packages`, `.meteor/release` | `restart app` |
| `Dockerfile.dev` | `docker compose -f sse-docker-stack.dev.yml build` then `up` |

Each `restart app` runs a full Meteor build (a few minutes). The running process does not watch the filesystem.

## Optional: hot reload on save

If you want the classic Meteor dev behaviour (reload immediately when you save a file):

```bash
SSE_HOT_RELOAD=1 SETTINGS_FILE=room_labels_new.json \
  docker compose -f sse-docker-stack.dev.yml up
```

## How it works

- **`Dockerfile.dev`**: Meteor 1.12 base image + `meteor npm install` at image build time.
- **Bind mount** `.` → `/opt/src` so your working tree is the app.
- **Named volumes** for `node_modules` and `.meteor/local` so macOS files are not used for Linux-native deps and Meteor’s cache stays in Docker.
- **Entrypoint** `scripts/docker-dev-entrypoint.sh`:
  - default: `meteor build` → `node main.js` on each container start/restart;
  - `SSE_HOT_RELOAD=1`: `meteor run` with file watcher.

## Stop

```bash
docker compose -f sse-docker-stack.dev.yml down
```

To wipe Meteor/npm cache volumes: `docker compose -f sse-docker-stack.dev.yml down -v` (also removes `borovets_sse_data_dev` Mongo volume).

## Logs on a remote server

### You see `Started proxy.` and then only Mongo logs

That means **`SSE_HOT_RELOAD=1`** (classic `meteor run`), not restart-only mode.

1. Check project `.env` on the server (Compose loads it automatically):
   ```bash
   grep SSE_HOT_RELOAD .env || true
   ```
   Remove `SSE_HOT_RELOAD=1` or set `SSE_HOT_RELOAD=0`.

2. Rebuild the dev image **without cache** after `git pull`:
   ```bash
   docker compose -f sse-docker-stack.dev.yml build --no-cache
   ```

3. On startup you must see:
   ```text
   [dev] entrypoint v7 | SSE_HOT_RELOAD=0 | cache=/var/cache/borovets-sse-meteor-build
   [dev] Mode: RESTART-ONLY (cached build + stashed server deps) — fast when deps are unchanged.
   ```
   If you see `HOT RELOAD` or `Started proxy.` — wrong mode.

4. Follow **app** logs only (less noise from Mongo):
   ```bash
   docker compose -f sse-docker-stack.dev.yml up app
   ```
   Or in another terminal: `docker compose -f sse-docker-stack.dev.yml logs -f app`

After `Started proxy.`, Meteor can sit **15–45 minutes** with almost no new lines while compiling. That is normal for `meteor run` on a slow server — not a freeze.

### Restart-only build seems stuck

First `meteor build` is slow and quiet. Watch app logs for `meteor build started` / `meteor build finished`. Full log inside the container: `/var/cache/borovets-sse-meteor-build/meteor-build.log`.

Ensure the server has enough RAM for Meteor (8 GB+ recommended).

## Notes

- First `up` or each `restart app` can take several minutes (Meteor build).
- Dev container is **linux/amd64** (Meteor base image); on Apple Silicon Docker runs it under emulation.
- Production stack (`sse-docker-stack.yml`) still requires **`--build`** when you change code baked into the image.
