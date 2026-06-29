# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Meteor 1.12 + React 16 web app for labeling 2D images (PNG/JPG) and 3D point clouds (PCD) to create AI training datasets. The app runs on `http://localhost:3000` (native) or `http://localhost:8500` (Docker dev).

## Running locally (native Meteor)

```bash
# Install Meteor once
curl https://install.meteor.com/ | sh

# Install deps and start
meteor npm install
meteor npm start          # uses settings.json, excludes legacy/cordova archs
```

## Docker development (preferred)

```bash
# Build image once (or after Dockerfile.dev / package.json changes)
docker compose -f sse-docker-stack.dev.yml build

# Start (code changes need a container restart, not a rebuild)
SETTINGS_FILE=room_labels_new.json docker compose -f sse-docker-stack.dev.yml up

# Apply code changes (JS/JSX/Less/etc.) — triggers meteor build + node restart
docker compose -f sse-docker-stack.dev.yml restart app

# Force full rebuild (e.g. after .meteor/packages changes)
SSE_FORCE_REBUILD=1 docker compose -f sse-docker-stack.dev.yml restart app

# Optional: classic hot-reload on file save (slow first compile, 15-45 min on a server)
SSE_HOT_RELOAD=1 SETTINGS_FILE=room_labels_new.json docker compose -f sse-docker-stack.dev.yml up

# Stop and remove containers (keep volumes)
docker compose -f sse-docker-stack.dev.yml down

# Stop and wipe all caches/data
docker compose -f sse-docker-stack.dev.yml down -v
```

Build logs inside the container: `/var/cache/borovets-sse-meteor-build/meteor-build.log`

## Configuration

`settings.json` controls data folders and label sets:
- `configuration.images-folder` — root folder served to the file navigator (empty = `$HOME/sse-images`)
- `configuration.internal-folder` — where `.labels` / `.objects` binary files for PCD are stored (empty = `$HOME/sse-internal`)
- `sets-of-classes` — array of named label sets; each object needs at minimum `label`; `color` and `icon` are optional

`room_labels_new.json` is an alternate settings file with a custom label set used in Docker dev.

## Architecture

### Routing (client/routes.jsx)
Three top-level routes:
- `/browse/:fromIndex/:pageLength/:path?` → `SseNavigatorApp` (file browser)
- `/edit/:path` → `SseEditorApp` (2D or 3D editor, chosen by file extension)
- `/annotated` → `SseAllAnnotated` (list of all annotated files)

### Editor split (imports/editor/)
`SseEditorApp` subscribes to `sse-data-descriptor` via Meteor and routes to either:
- **2D** (`imports/editor/2d/`) — `SseApp2d` / `SseEditor2d`, polygon drawing with Paper.js. Tools: Polygon (`SsePolygonTool`), Magic/flood fill (`SseFloodTool`), Cut (`SseCutTool`), Pointer (`SsePointerTool`), Rectangle (`SseRectangleTool`).
- **3D** (`imports/editor/3d/`) — `SseApp3d` / `SseEditor3d`, point cloud rendering with three.js + custom `SsePCDLoader`. Selection tools: `Sse3dRectangleSelector`, `Sse3dCircleSelector`, `Sse3dLassoSelector`.

### Messaging (imports/common/SseMsg.js)
Components communicate via a postal.js pub/sub bus wrapped in `SseMsg`. Call `SseMsg.register(this)` in a component to gain `this.sendMsg(name, arg)`, `this.onMsg(name, cb)`, and `this.retriggerMsg(key)`. Call `SseMsg.unregister(this)` on unmount.

### Data persistence
- **2D annotations** — upserted into MongoDB (`SseSamples` collection) via the `saveData` Meteor method. The document stores polygon objects with `classIndex` referencing the active set-of-classes.
- **3D annotations** — stored as binary `.labels` and `.objects` files on disk in `internal-folder`, compressed/decompressed by `SseDataWorkerServer`.

### Server (server/)
- `main.js` — Meteor methods: `getClassesSets`, `images` (directory listing), `saveData`
- `api.js` — REST endpoints mounted via `WebApp.connectHandlers`:
  - `GET /api/listing` — all annotated files
  - `GET /api/json/<path>` — 2D polygon data with resolved labels
  - `GET /api/pcdtext/<path>` / `GET /api/pcdfile/<path>` — 3D labeled PCD as ASCII
- `config.js` — reads `Meteor.settings`, resolves `imagesFolder` / `pointcloudsFolder` / `setsOfClassesMap`
- `SseDataWorkerServer.js` — compress/uncompress binary label arrays for PCD files

### Common utilities (imports/common/)
- `SseSetOfClasses.js` — wraps a label-set config; provides label↔index↔color lookups
- `SseDataManager.js` — client-side data access layer
- `SseGlobals.jsx` — global helpers (e.g. `hex2rgb`)
- `lib/collections.js` — defines the `SseSamples` and `SseProps` Mongo collections shared between client and server

## Docker internals

- **`Dockerfile.dev`** — Meteor 1.12 base image; `meteor npm install` runs at image build time. The repo is bind-mounted to `/opt/src`.
- **`scripts/docker-dev-entrypoint.sh`** — content-fingerprints source files; skips `meteor build` when nothing changed; stashes server `node_modules` by `npm-shrinkwrap.json` hash for fast reinstalls.
- Named volumes keep `node_modules` and `.meteor/local` Linux-native (important on macOS/Apple Silicon, which runs the image under amd64 emulation).
- `sse-docker-stack.yml` is the production Docker Compose stack (pre-built image, no bind mounts).
