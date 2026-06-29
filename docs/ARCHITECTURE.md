# Semantic Segmentation Editor — Architecture

> 🇷🇺 Русская версия: [`ARCHITECTURE.ru.md`](./ARCHITECTURE.ru.md)
>
> A deep-dive reference for developers working on this codebase. For setup
> commands see [`CLAUDE.md`](../CLAUDE.md); for the recent feature/bugfix log see
> [`CHANGES.md`](./CHANGES.md); for the Docker dev workflow see
> [`DOCKER_DEV.md`](./DOCKER_DEV.md).

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Technology stack](#2-technology-stack)
3. [System overview](#3-system-overview)
4. [Repository layout](#4-repository-layout)
5. [Routing](#5-routing)
6. [Component tree](#6-component-tree)
7. [The messaging bus (SseMsg / postal.js)](#7-the-messaging-bus-ssemsg--postaljs)
8. [Sets of classes](#8-sets-of-classes)
9. [Data model & persistence](#9-data-model--persistence)
10. [3D editor lifecycle](#10-3d-editor-lifecycle)
11. [PCD format & the binary label pipeline](#11-pcd-format--the-binary-label-pipeline)
12. [2D editor flow](#12-2d-editor-flow)
13. [Server methods & REST API](#13-server-methods--rest-api)
14. [Configuration](#14-configuration)
15. [Docker architecture](#15-docker-architecture)

---

## 1. What this is

A **Meteor 1.12 + React 16** web application for labeling **2D images** (PNG/JPG/BMP)
and **3D point clouds** (PCD) to produce AI training datasets. It was originally
built by Hitachi Automotive & Industry Lab for autonomous-driving research.

Two editors share one shell:

- **2D editor** — polygon drawing over a bitmap using **Paper.js**.
- **3D editor** — point-cloud rendering and selection using **three.js**.

The app runs at `http://localhost:3000` (native Meteor) or `http://localhost:8500`
(Docker dev).

---

## 2. Technology stack

```mermaid
graph LR
    SSE(("SSE"))

    SSE --> Runtime["Runtime"]
    SSE --> Frontend["Frontend"]
    SSE --> E2D["2D engine"]
    SSE --> E3D["3D engine"]
    SSE --> Cross["Cross-cutting"]
    SSE --> Data["Data codec"]

    Runtime --> R1["Meteor 1.12"]
    Runtime --> R2["Node.js"]
    Runtime --> R3["MongoDB"]

    Frontend --> F1["React 16"]
    Frontend --> F2["Material-UI 4.11"]
    Frontend --> F3["mdi-material-ui icons"]

    E2D --> P1["Paper.js"]
    E2D --> P2["magic-wand flood fill"]

    E3D --> T1["three.js"]
    E3D --> T2["OrbitControls"]
    E3D --> T3["tween.js"]

    Cross --> C1["postal.js — pub/sub bus"]
    Cross --> C2["Mousetrap — keyboard"]
    Cross --> C3["tippy.js — tooltips"]
    Cross --> C4["jQuery — DOM glue"]

    Data --> D1["LZW + FastIntegerCompression"]
    Data --> D2["Web Worker — SseDataWorker"]
```

---

## 3. System overview

The browser talks to the Meteor server over two channels: **DDP** (Meteor's
reactive websocket protocol — methods + publications) and **plain HTTP**
(static file serving, binary label upload, REST export API).

```mermaid
graph TB
    subgraph Browser["🌐 Browser (React 16 client)"]
        Nav["SseNavigatorApp<br/>file browser"]
        Ed2d["SseApp2d / SseEditor2d<br/>Paper.js"]
        Ed3d["SseApp3d / SseEditor3d<br/>three.js"]
        Worker["SseDataWorker<br/>(Web Worker)<br/>LZW + FIC codec"]
        Bus(("postal.js<br/>UI message bus"))
    end

    subgraph Server["🖥️ Meteor server (Node.js)"]
        Methods["Meteor methods<br/>getClassesSets · images · saveData"]
        Pubs["Publications<br/>sse-data-descriptor · sse-labeled-images"]
        API["REST handlers (api.js)<br/>/api/json · /api/pcdtext · /api/pcdfile · /api/listing"]
        Files["File handlers (files.js)<br/>/file · /datafile · /save"]
    end

    Mongo[("MongoDB<br/>SseSamples · SseProps")]
    FS[("Filesystem<br/>images-folder (.pcd/.png)<br/>internal-folder (.labels/.objects)")]

    Nav -- DDP --> Methods
    Ed2d -- DDP --> Methods
    Ed3d -- DDP --> Methods
    Ed2d -- DDP sub --> Pubs
    Ed3d -- DDP sub --> Pubs

    Ed3d -- "HTTP GET /datafile/*.labels" --> Files
    Ed3d -- "HTTP POST /save/*" --> Files
    Ed3d <-- "encode/decode" --> Worker

    Methods --> Mongo
    Pubs --> Mongo
    Files --> FS
    API --> Mongo
    API --> FS

    Browser -. "all UI components communicate" .- Bus
```

**Key idea:** 2D annotations live in **MongoDB**; 3D annotations live as **binary
files on disk** (only lightweight metadata, including the chosen label set, is
mirrored to MongoDB).

---

## 4. Repository layout

```mermaid
graph LR
    root["semantic-segmentation-editor/"]
    root --> client["client/<br/>entry, routes, styles"]
    root --> imports["imports/<br/>app code"]
    root --> server["server/<br/>methods, API, config"]
    root --> lib["lib/<br/>shared Mongo collections"]
    root --> public["public/<br/>SseDataWorker.js"]
    root --> scripts["scripts/<br/>docker entrypoint"]
    root --> docker["Dockerfile(.dev)<br/>sse-docker-stack*.yml"]

    imports --> common["common/<br/>SseMsg, SseToolbar,<br/>SseClassChooser,<br/>SseSetOfClasses, ..."]
    imports --> editor["editor/<br/>SseEditorApp"]
    imports --> nav["navigator/<br/>SseNavigatorApp, ..."]
    editor --> d2["2d/ + 2d/tools/<br/>Paper.js editor"]
    editor --> d3["3d/ + 3d/tools/<br/>three.js editor"]
```

| Path | Responsibility |
|------|----------------|
| `client/main.js` / `main.html` | Client entry point; mounts `renderRoutes()` |
| `client/routes.jsx` | React Router route table |
| `client/main.less`, `layout.css`, `tippy.css` | Styling |
| `lib/collections.js` | Defines `SseSamples`, `SseProps`; declares publications |
| `server/main.js` | Meteor methods: `getClassesSets`, `images`, `saveData` |
| `server/api.js` | REST export endpoints |
| `server/files.js` | Static file serving + binary label upload (`/save`) |
| `server/config.js` | Parses `Meteor.settings` into resolved paths + class map |
| `server/SseDataWorkerServer.js` | Server-side LZW + integer (de)compression |
| `public/SseDataWorker.js` | Client Web Worker: same codec, runs off-thread |
| `imports/common/` | Shared infra: message bus, toolbar base, class chooser |
| `imports/editor/2d/` | Paper.js polygon editor + tools |
| `imports/editor/3d/` | three.js point-cloud editor + selectors |
| `imports/navigator/` | File browser & "all annotated" views |

---

## 5. Routing

`client/routes.jsx` uses React Router with a browser history. The editor picks 2D
vs 3D purely from the file extension.

```mermaid
flowchart TD
    A["/"] -->|redirect| B["/browse/0/20/"]
    B["/browse/:fromIndex/:pageLength/:path?"] --> Nav["SseNavigatorApp<br/>(file browser)"]
    C["/edit/:path"] --> EApp["SseEditorApp"]
    D["/annotated"] --> All["SseAllAnnotated<br/>(list of labeled files)"]

    EApp -->|"path ends with .pcd"| ThreeD["SseApp3d (3D)"]
    EApp -->|"otherwise"| TwoD["SseApp2d (2D)"]

    Edash["/edit  ·  /edit/"] -->|redirect| B
```

`SseEditorApp` subscribes to the `sse-data-descriptor` publication for the current
file and **renders nothing until the subscription is ready** (`subReady`). This
guarantees that when a child editor mounts, its MongoDB descriptor is already
available locally.

```js
// imports/editor/SseEditorApp.jsx (withTracker)
const imageUrl = "/" + props.match.params.path;
const subscription = Meteor.subscribe("sse-data-descriptor", imageUrl);
const subReady = subscription.ready();
const mode = props.match.params.path.endsWith(".pcd") ? "3d" : "2d";
```

---

## 6. Component tree

Both app shells (`SseApp2d`, `SseApp3d`) wrap their editor in a Material-UI theme
provider and surround it with toolbars, the class chooser, and status bars.

```mermaid
graph TD
    EApp["SseEditorApp<br/>(withTracker → subReady, mode)"]
    EApp --> App3d["SseApp3d"]
    EApp --> App2d["SseApp2d"]

    subgraph S3["3D shell"]
        App3d --> TB3["SseToolbar3d"]
        App3d --> CC3["SseClassChooser"]
        App3d --> ED3["SseEditor3d ⭐ core"]
        App3d --> CAM["SseCameraToolbar"]
        App3d --> OBJ["SseObjectToolbar"]
        App3d --> BB3["SseBottomBar"]
        App3d --> TT3["SseTooltips3d"]
    end

    subgraph S2["2D shell"]
        App2d --> TB2["SseToolbar2d"]
        App2d --> CC2["SseClassChooser"]
        App2d --> ED2["SseEditor2d ⭐ core"]
        App2d --> LAY["SseLayers"]
        App2d --> SLD["SseSliderPanel"]
        App2d --> BB2["SseBottomBar"]
    end

    App3d -.->|"Meteor.call getClassesSets"| CS["SseSetOfClasses[]"]
    App2d -.->|"Meteor.call getClassesSets"| CS
```

Most interactive components extend **`SseToolbar`**, which in its constructor calls
`SseMsg.register(this)` and wires Mousetrap keyboard shortcuts and tippy tooltips.
That is how a button click anywhere becomes a message on the shared bus.

---

## 7. The messaging bus (SseMsg / postal.js)

Components do **not** call each other directly. They publish/subscribe named
messages on a single postal.js channel (`ui` / topic `msg`). `SseMsg.register(obj)`
decorates any object with `sendMsg`, `onMsg`, `forgetMsg`, and `retriggerMsg`.

```mermaid
sequenceDiagram
    participant Toolbar as SseToolbar3d
    participant Bus as postal.js (ui/msg)
    participant Chooser as SseClassChooser
    participant Editor as SseEditor3d

    Note over Toolbar,Editor: All three called SseMsg.register(this)

    Toolbar->>Bus: sendMsg("rectangle")
    Bus-->>Editor: actions["rectangle"](arg)
    Editor->>Editor: switch selection tool

    Chooser->>Bus: sendMsg("active-soc", {value: soc})
    Bus-->>Editor: actions["active-soc"](arg)
    Bus-->>Chooser: actions["active-soc"](arg)
    Note right of Bus: every subscriber with a<br/>matching onMsg handler fires

    Editor->>Bus: sendMsg("class-instance-count", {classIndex, count})
    Bus-->>Chooser: update per-class counters (the <sup> badge)
```

Useful details:

- **Synchronous dispatch.** `postal.publish` invokes subscribers inline, so
  `setState` calls triggered inside an `onMsg` handler are batched together with
  the originating React event handler.
- **`retriggerMsg(key)`** replays the *last* message of a given name — handy for a
  late-mounting component that needs the current state (e.g. re-applying the active
  set of classes). `SseMsg` keeps a static `lastMessages` map for this.
- **Unregister on unmount** with `SseMsg.unregister(this)` to avoid leaks.

A non-exhaustive map of the busiest 3D messages:

| Message | Sender → Receiver | Meaning |
|---------|-------------------|---------|
| `editor-ready` | Editor → ClassChooser | editor mounted; carries persisted `socName` (or none) |
| `active-soc` | ClassChooser → Editor | the active set of classes changed |
| `classSelection` / `classIndex-select` | either → both | active class index changed |
| `class-instance-count` | Editor → ClassChooser | point count per class (sidebar badges) |
| `rectangle` / `circle` / `selector` | Toolbar → Editor | switch selection tool |
| `selection-changed` | Editor → toolbars | selection set updated |
| `object-new` / `object-select` / `object-delete` | Toolbar ↔ Editor | object (instance) lifecycle |
| `rgb-toggle` / `point-size` / `color-boost` | Toolbar → Editor | rendering options |

---

## 8. Sets of classes

A **set of classes** (SOC) is a named list of label descriptors. `getClassesSets`
(server) reads them from `settings.json` and auto-assigns colors (via
`color-scheme`) to any descriptor missing one. On the client each raw config is
wrapped in an **`SseSetOfClasses`** instance providing index ↔ label ↔ color lookups.

```mermaid
classDiagram
    class SseSetOfClasses {
        +name
        +classesCount
        +descriptors
        +labels
        +labelForIndex(idx)
        +colorForIndexAsHex(idx)
        +colorForIndexAsRGBArray(idx)
        +descriptorForLabel(label)
        +indexForLabel(label)
        +clone
    }
    class Descriptor {
        +label
        +color  (#hex)
        +icon   (optional, mdi name)
        +classIndex  (= array position)
    }
    SseSetOfClasses "1" *-- "many" Descriptor : objects[]
```

The **`classIndex` is simply the position** of a descriptor in the set's `objects`
array. By convention **index 0 is the background/void class**. This is why the
`Delete`/`D` shortcut in the 3D editor assigns class `0` to the selection — it
"erases" points back to background.

---

## 9. Data model & persistence

Two collections (`lib/collections.js`), shared client+server:

```mermaid
erDiagram
    SseSamples {
        string url "primary key (file path)"
        string folder
        string file
        string socName "selected set of classes"
        array  objects "2D polygons OR 3D object instances"
        array  tags
        date   firstEditDate
        date   lastEditDate
    }
    SseProps {
        string key "e.g. 'tags'"
        array  value
    }
```

The **persistence path differs by editor type**:

```mermaid
flowchart LR
    subgraph TwoD["2D annotations"]
        P2["polygons with classIndex"] -->|"Meteor.call saveData"| M2[("SseSamples<br/>objects[] = polygons")]
    end

    subgraph ThreeD["3D annotations"]
        L3["per-point classIndex array"] -->|"HTTP POST /save"| F1[(".labels file<br/>compressed")]
        O3["object instances"] -->|"HTTP POST /save"| F2[(".objects file<br/>compressed")]
        Meta["{url, socName, ...}"] -->|"Meteor.call saveData"| M3[("SseSamples<br/>metadata only")]
    end
```

- **2D** stores the actual polygon geometry inside the Mongo document
  (`objects[].polygon`, `classIndex`, `layer`).
- **3D** keeps only **metadata** in Mongo (notably `socName`, so a reload restores
  the chosen label set). The heavy per-point data lives in two binary files in the
  *internal-folder*: `*.pcd.labels` (one class index per point) and `*.pcd.objects`
  (instance grouping).

---

## 10. 3D editor lifecycle

This is the flow that drives "open a cloud → choose a label set → annotate →
persist", including the mandatory first-time set chooser.

```mermaid
sequenceDiagram
    autonumber
    participant URL as Router (/edit/...pcd)
    participant App as SseApp3d
    participant Ed as SseEditor3d
    participant CC as SseClassChooser
    participant Mongo as MongoDB (SseSamples)
    participant Disk as internal-folder

    URL->>App: mount (subReady guaranteed)
    App->>Mongo: Meteor.call getClassesSets
    Mongo-->>App: sets → SseSetOfClasses[]
    App->>Ed: render with classesSets
    App->>CC: render with classesSets

    Ed->>Mongo: findOne({url}) → pendingServerMeta
    Ed->>CC: sendMsg("editor-ready", {socName})

    alt socName present (returning visit)
        CC->>Ed: sendMsg("active-soc", {resolved SOC})
    else no record (first visit)
        CC->>CC: show REQUIRED set-chooser modal
        Note over CC: user must pick a set (no cancel)
        CC->>Ed: sendMsg("active-soc", {chosen SOC})
    end

    Ed->>Ed: start() — meta.socName = activeSoc.name
    Ed->>Mongo: saveMeta() (persist socName immediately)
    Ed->>Disk: GET *.labels / *.objects (if any)
    Disk-->>Ed: decompress via Web Worker → per-point classIndex
    Ed->>Ed: display() — color points by class
    Ed->>CC: class-instance-count per class (sidebar badges)

    loop user annotates
        Ed->>Ed: select points → assignNewClass(idx, classIndex)
        Ed->>Disk: POST /save *.labels (+ *.objects)
        Ed->>Mongo: saveMeta()
    end
```

State machine for the class chooser modal:

```mermaid
stateDiagram-v2
    [*] --> Empty: soc = null
    Empty --> Required: editor-ready with NO socName
    Empty --> Active: editor-ready WITH socName
    Required --> Active: user picks a set (active-soc)
    Active --> ChangeMenu: click "Classes Sets"
    ChangeMenu --> Active: pick / cancel
    Active --> [*]
```

> The `display()` method always assigns `classIndex` to every point *before*
> building the color buffer, regardless of the RGB display toggle. This is load-
> bearing: `updateClassFilter()` reads `classesData[pt.classIndex].visible`, so a
> missing `classIndex` would crash. See [`CHANGES.md`](./CHANGES.md).

---

## 11. PCD format & the binary label pipeline

### PCD parsing

`SsePCDLoader` is a trimmed three.js `PCDLoader` (ASCII only) that extracts header
fields (`FIELDS x y z rgb label object`), positions, optional `rgb`, labels, and
object ids.

### Why a Web Worker

A 1-million-point cloud's label array is large. Compression/decompression runs in
**`public/SseDataWorker.js`** (a Web Worker) so the UI thread never blocks. The
identical codec also exists server-side in `SseDataWorkerServer.js` for the export
API.

```mermaid
flowchart TD
    subgraph Save["Save .labels (client → disk)"]
        A["cloudData[].classIndex<br/>(int array)"] --> B["SseDataWorker<br/>LZW string encode"]
        B --> C["FastIntegerCompression<br/>variable-byte ints"]
        C --> D["ArrayBuffer"]
        D -->|"POST /save/<path>.labels<br/>(application/octet-stream)"| E[(".labels file")]
    end

    subgraph Load["Load .labels (disk → client)"]
        F[(".labels file")] -->|"GET /datafile/<path>.labels"| G["ArrayBuffer"]
        G --> H["FIC decompress"]
        H --> I["LZW decode"]
        I --> J["int array → per-point classIndex"]
    end
```

The codec is two stages:

1. **LZW** — dictionary string compression (`SseDataManager.LZW`).
2. **FastIntegerCompression (FIC)** — variable-length byte encoding of the LZW code
   stream (1–5 bytes per integer depending on magnitude).

`server/files.js` writes uploaded buffers with `createWriteStream`. It uses
`path.join` (avoids double-slashes) and an `wstream.on('error', …)` handler so a
filesystem `EPERM` returns HTTP 500 instead of crashing the Node process.

---

## 12. 2D editor flow

The 2D editor draws polygons on a Paper.js canvas. Each tool (`SsePolygonTool`,
`SseFloodTool` / magic wand, `SseCutTool`, `SseRectangleTool`, `SsePointerTool`)
extends `SseTool` and receives mouse/keyboard callbacks.

```mermaid
flowchart LR
    Tool["active tool<br/>(Polygon / Magic / Cut / ...)"] --> Path["Paper.js Path<br/>(segments)"]
    Path --> Feature["feature {classIndex, layer}"]
    Feature -->|saveData| Sample["currentSample.objects[]"]
    Sample -->|"Meteor.call saveData"| Mongo[("SseSamples")]
    Undo["SseUndoRedo2d"] -. snapshots .- Path
    Layers["SseLayers"] -. show/hide/reorder .- Path
```

On `saveData`, each path is serialized to a `{classIndex, layer, polygon:[[x,y]…]}`
object and the whole `currentSample` is upserted into `SseSamples` via the
`saveData` Meteor method.

---

## 13. Server methods & REST API

### Meteor methods (`server/main.js`)

```mermaid
flowchart TD
    GCS["getClassesSets()"] --> CFG["settings 'sets-of-classes'<br/>+ auto colors (color-scheme)"]
    IMG["images(folder, page, len)"] --> DIR["readdir imagesFolder<br/>→ folders + paginated images"]
    SAVE["saveData(sample)"] --> UP["SseSamples.upsert({url}, sample)<br/>sets folder/file/dates, tags→SseProps"]
```

| Method | Purpose |
|--------|---------|
| `getClassesSets()` | Returns all label sets with colors filled in |
| `images(folder, pageIndex, pageLength)` | Paginated directory listing for the navigator |
| `saveData(sample)` | Upsert a sample doc (2D polygons *or* 3D metadata) |

### REST API (`server/api.js`, mounted via `WebApp.connectHandlers`)

```mermaid
graph LR
    C1["GET /api/listing"] --> R1["all annotated files (JSON)"]
    C2["GET /api/json/&lt;path&gt;"] --> R2["2D polygons with resolved labels"]
    C3["GET /api/pcdtext/&lt;path&gt;"] --> R3["labeled PCD as ASCII (inline)"]
    C4["GET /api/pcdfile/&lt;path&gt;"] --> R4["labeled PCD as ASCII (download)"]
```

`/api/pcdtext` and `/api/pcdfile` re-merge the original `.pcd`, the decompressed
`.labels`, and the `.objects` grouping into a single ASCII PCD with
`FIELDS x y z [rgb] label object`. `/api/json` resolves each polygon's `classIndex`
to its human label using the sample's `socName` (with null-safety if the set or
index is missing).

---

## 14. Configuration

`settings.json` (or an alternate like `room_labels_new.json`) drives everything.
`server/config.js` resolves it once at startup.

```mermaid
flowchart TD
    S["settings.json"] --> CFG["server/config.js init()"]
    CFG --> IF["imagesFolder<br/>(images-folder or ~/sse-images)"]
    CFG --> PF["pointcloudsFolder<br/>(internal-folder or ~/sse-internal)"]
    CFG --> MAP["setsOfClassesMap<br/>(name → SOC config)"]
    IF -.->|"missing → create + download samples"| DL["sample png + pcd from GitHub"]
```

| Key | Meaning | Default |
|-----|---------|---------|
| `configuration.images-folder` | Root folder served to the navigator | `$HOME/sse-images` |
| `configuration.internal-folder` | Where `.labels` / `.objects` are stored | `$HOME/sse-internal` |
| `configuration.demo-mode` | If true, `saveData` and `/save` are no-ops | — |
| `sets-of-classes` | Array of named label sets (`label` required; `color`, `icon` optional) | built-in "33 Classes" |

---

## 15. Docker architecture

Two compose stacks share one image family.

```mermaid
graph TB
    subgraph Dev["sse-docker-stack.dev.yml (development)"]
        DApp["app (Dockerfile.dev)<br/>repo bind-mounted at /opt/src<br/>entrypoint: docker-dev-entrypoint.sh"]
        DMongo["mongo:7.0"]
        DVols["named volumes:<br/>node_modules · .meteor/local<br/>build cache · npm cache · db"]
        DApp --> DMongo
        DApp -.-> DVols
    end

    subgraph Prod["sse-docker-stack.yml (production)"]
        PApp["app (pre-built image,<br/>no bind mounts)"]
        PMongo["mongo"]
        PApp --> PMongo
    end
```

### Dev entrypoint build logic

The entrypoint **content-fingerprints the source** and skips `meteor build` when
nothing changed, and **stashes the server bundle's `node_modules` by
`npm-shrinkwrap.json` hash** so a rebuild restores them via hardlinks (seconds)
instead of reinstalling (~10 min).

```mermaid
flowchart TD
    Start["container start / restart"] --> Deps{"node_modules present?"}
    Deps -- no --> Install["meteor npm install"]
    Deps -- yes --> FP
    Install --> FP["compute source fingerprint"]
    FP --> Mode{"SSE_HOT_RELOAD == 1 ?"}
    Mode -- yes --> Hot["meteor run<br/>(slow first compile, hot reload on save)"]
    Mode -- no --> Changed{"fingerprint changed<br/>or SSE_FORCE_REBUILD?"}
    Changed -- no --> Restore["restore stashed server deps<br/>run cached bundle"]
    Changed -- yes --> Build["meteor build → stash server deps → run bundle"]
    Restore --> Run["node main.js (PORT 3000 → 8500)"]
    Build --> Run
    Hot --> Run
```

Named volumes keep `node_modules` and `.meteor/local` **Linux-native**, which
matters on macOS / Apple Silicon where the image runs under amd64 emulation. Build
logs live at `/var/cache/borovets-sse-meteor-build/meteor-build.log` inside the
container.

| Command | Effect |
|---------|--------|
| `docker compose -f sse-docker-stack.dev.yml build` | Build the dev image (runs `meteor npm install`) |
| `… up` | Start; builds on container start |
| `… restart app` | Apply JS/JSX/Less changes (build only if sources changed) |
| `SSE_FORCE_REBUILD=1 … restart app` | Force full rebuild + server npm install |
| `SSE_HOT_RELOAD=1 … up` | Classic hot reload on save |
| `… down` / `down -v` | Stop (keep volumes) / wipe all caches & data |

---

*Diagrams are written in [Mermaid](https://mermaid.js.org/) and render natively on
GitHub and in most Markdown viewers.*
