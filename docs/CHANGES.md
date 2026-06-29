# Changes summary

Base commit: `ead980c` — everything before this was untouched.

## Recent commits

### `a1e119e` — Large settings file fix and dev data backups

- **Large `METEOR_SETTINGS` / `Argument list too long`:** exporting a big settings JSON (e.g. `sse_labels_roomlabels-*.json` with Cyrillic labels, ~138 KB UTF-8) into `METEOR_SETTINGS` before `mkdir`/`node` hit Linux `MAX_ARG_STRLEN` (128 KiB per env value). Symptom: entrypoint failed on an unrelated command such as `mkdir`, exit 126. Fix: pass only `SETTINGS_FILE` (short path) in env; load JSON inside Node via `node -r /usr/local/lib/sse/load-meteor-settings.js main.js` after `meteor build`.
- **Browser `Cannot find module 'fs'`:** placing `load-meteor-settings.js` under `/opt/src/scripts/` caused Meteor to bundle it for `web.browser`. Fix: mount/COPY the loader outside `/opt/src` (`/usr/local/lib/sse/`) and add `.meteorignore` for `scripts/` and `backups/`.
- **Dev backups:** added `scripts/backup-dev-data.sh` — read-only backup of MongoDB (`mongodump` from `borovets-sse-mongo-dev`) and `/root/sse-internal` (tar from `borovets-sse-app-dev`) into timestamped `backups/` folders; `backups/` added to `.gitignore`.

### `fdd0ecb` — Background visibility shortcut and solo/mute behavior

- Added a 3D shortcut `E` to toggle background (`classIndex === 0`) visibility.
- Routed the shortcut through `SseClassChooser` so the EyeOff button state and editor filtering stay in sync.
- Updated 3D class filtering so a class in solo mode can still be hidden with mute (`visible = solo && !mute`).
- Added a `.gitignore` entry for local future 3D undo/redo planning notes.

### `b797d1a` — Save status tooltip cleanup

- Moved save-status tooltip content into `SseTooltips3d` using the existing hidden help block pattern.
- Updated `SseBottomBar` to initialize tippy from `data-tippy-html="#saveStatusHelp"`.
- Simplified save status labels in `SseEditor3d` so detailed explanations live in the tooltip.

### `983ffa9` — Selection click and tooltip copy

- Removed the automatic `displayAll()` / fit-view behavior from empty canvas clicks; centering now stays tied to the explicit Center View action.
- Updated the Center View tooltip text to match the new behavior.

### `88fac1c` — Counter refresh after delete shortcut

- Added `invalidateCounters()` after the 3D `D` / `Delete` shortcut resets selected points to background.

### `c77e49d` — 3D save status and reliable save tracking

- Made `SseDataManager.saveBinaryFile()` return a Promise with HTTP success/error/timeout handling.
- Updated 3D `saveAll()` to track binary label save, binary object save, and metadata save results together.
- Added save status publishing (`Saving...`, `Saved`, `Unsaved changes`, `Connection lost`) and throttled failure alerts.
- Added a centered save-status badge in `SseBottomBar` with styles in `client/main.less`.
- Added DDP connection hints without treating DDP status as a replacement for binary POST results.

## What was done

### Feature: mandatory label set selection + persistence

When a user opens a PCD cloud for the first time (no MongoDB record), a modal dialog appears and forces them to choose a label set before the editor loads. The chosen set is immediately saved to MongoDB so subsequent page reloads restore it automatically without showing the modal again.

### Bug fixes

- **Docker dev: `Argument list too long` on startup** (`scripts/docker-dev-entrypoint.sh`): removed `export METEOR_SETTINGS="$(cat "$SETTINGS_FILE")"`. Large settings files (especially UTF-8 Cyrillic labels) exceed the 128 KiB per-env limit on `execve`, so any subprocess (`mkdir`, `node`, …) failed after export. Settings are now loaded from `SETTINGS_FILE` by a Node preload script instead.
- **Docker dev: `Cannot find module 'fs'` in browser** (`scripts/load-meteor-settings.js`): Meteor bundled the Node-only preload script into the client bundle when it lived under `/opt/src`. Fixed by mounting the loader at `/usr/local/lib/sse/load-meteor-settings.js` and ignoring `scripts/` in `.meteorignore`.
- **Server crash on EPERM** (`server/files.js`): writing `.labels`/`.objects` files via `createWriteStream` had no error handler — an unhandled error event crashed the Node process. Fixed with `wstream.on('error', ...)`. Also fixed a double-slash in the file path (`string +` replaced with `path.join()`).
- **`updateClassFilter` crash** (`SseEditor3d`): when `displayRgb = true`, `display()` built RGB color buffer but skipped assigning `classIndex` on `cloudData` points. Then `updateClassFilter` did `classesData[pt.classIndex].visible` where `classIndex` was `undefined` → TypeError. Fixed by always assigning `classIndex` from `labelArray` first, separately from color building.
- **`labelForIndex` crash on hover** (`SseEditor3d`): `setHighlightFeedback` called `activeSoc.labelForIndex(classIndex)` without checking bounds — crashed if `classIndex` was outside the set's range. Fixed with `classIndex < activeSoc.classesCount` guard.
- **`paintScene` null crash** (`SseEditor3d`): `this.rgbArray.length` was accessed without a null check. Fixed to `this.rgbArray && this.rgbArray.length > 0`.
- **API null crash** (`server/api.js`): `soc.objects[classIndex].label` crashed if `soc` was not found or index was out of range. Added null-safety.

---

## Files changed

### `imports/common/SseClassChooser.jsx`

- Initial `soc: null` instead of auto-selecting `classesSets[0]`
- Added `mode: null` to state
- Replaced `editor-ready` handler: if `socName` is present in the message → resolve and send `active-soc` immediately (no modal); if absent → show `required-set-chooser` modal
- Added `_renderRequiredSetChooser()` — a mandatory modal that lists all available sets
- `active-soc` handler now also calls `setState({soc: arg.value})` so the label list renders after selection
- Removed `currentSample` and `active-soc-name` handlers (no longer needed)
- Guarded `soc.descriptors` and the "Classes Sets" button renders against `soc === null`
- Fixed `renderDialog()` null guard: `soc && cset.name === soc.name`
- Fixed `getIcon` null guard: `objDesc &&` before accessing `objDesc.icon`

### `imports/editor/3d/SseEditor3d.jsx`

- `messages()`: reads `SseSamples.findOne` before sending `editor-ready`, passes `socName` in the message payload
- `start()`: uses already-read `pendingServerMeta` (no second DB read); calls `saveMeta()` immediately after setting `meta.socName` so the set is persisted even if the user reloads before making any annotations; removed `sendMsg("active-soc-name", ...)` (chooser now handles restore via `editor-ready`)
- `display()`: separated `classIndex` assignment from color building — `classIndex` is now always set from `labelArray` regardless of `displayRgb`; color building uses `try/catch` around `activeSoc.colorForIndexAsRGBArray`
- `paintScene()`: added `this.rgbArray &&` null guard
- `setHighlightFeedback()`: added `data.classIndex < this.activeSoc.classesCount` bounds check

### `server/files.js`

- `path.join(pointcloudsFolder, relPath)` instead of string concatenation (fixes double-slash)
- Added `wstream.on('error', ...)` handler to prevent server crash on EPERM

### `server/api.js`

- `obj.label = soc && soc.objects[obj.classIndex] ? ... : String(obj.classIndex)` — null-safe label resolution

### `room_labels_new.json`

- Added `{"label": "orphan", "color": "#FF00FF"}` to RoomLabels set
- Added new set "Location02-E-R1-1023" (subset of RoomLabels objects with the same colors)

### `sse-docker-stack.dev.yml`

- Added comments explaining restart workflow
- Added `SSE_FORCE_REBUILD` and `SSE_HOT_RELOAD` env vars with defaults
- Switched default `SSE_IMAGES` path to `./pcd_samples` for local dev
- Bind-mount `./scripts/load-meteor-settings.js` to `/usr/local/lib/sse/load-meteor-settings.js` (outside `/opt/src`, not scanned by Meteor build)

### `scripts/docker-dev-entrypoint.sh`

- Removed `export_meteor_settings()` (large JSON in env broke `execve`)
- Start production bundle with `node -r /usr/local/lib/sse/load-meteor-settings.js main.js`; export absolute `SETTINGS_FILE` path only

### `scripts/backup-dev-data.sh`

- New script: `./scripts/backup-dev-data.sh` backs up dev MongoDB and `sse-internal` from running containers into `backups/<timestamp>/`
- Uses `mongodump --gzip` inside `borovets-sse-mongo-dev` and `tar` of `/root/sse-internal` inside `borovets-sse-app-dev` (read-only; safe while stack is up)
- Writes `README.txt` with restore commands in each backup folder

### `scripts/load-meteor-settings.js`

- Node preload (`-r`): reads `SETTINGS_FILE` into `process.env.METEOR_SETTINGS` inside the Node process
- Avoids passing large JSON through `execve` env (Linux 128 KiB limit per variable)
- Installed in the image via `Dockerfile.dev`; overridden at runtime by compose bind-mount

### `.meteorignore`

- Ignores `scripts/` and `backups/` so dev tooling is not bundled into the Meteor app

### `CLAUDE.md`

- Created project documentation file for Claude Code with architecture overview, running instructions, and Docker dev workflow
