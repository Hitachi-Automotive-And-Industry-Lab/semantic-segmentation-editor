# Semantic Segmentation Editor — Архитектура

> Подробный справочник для разработчиков, работающих с этой кодовой базой. Команды
> запуска см. в [`CLAUDE.md`](../CLAUDE.md); журнал последних изменений — в
> [`CHANGES.md`](./CHANGES.md); рабочий процесс Docker-разработки — в
> [`DOCKER_DEV.md`](./DOCKER_DEV.md). Английская версия —
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Содержание

1. [Что это](#1-что-это)
2. [Технологический стек](#2-технологический-стек)
3. [Обзор системы](#3-обзор-системы)
4. [Структура репозитория](#4-структура-репозитория)
5. [Маршрутизация](#5-маршрутизация)
6. [Дерево компонентов](#6-дерево-компонентов)
7. [Шина сообщений (SseMsg / postal.js)](#7-шина-сообщений-ssemsg--postaljs)
8. [Наборы классов](#8-наборы-классов)
9. [Модель данных и хранение](#9-модель-данных-и-хранение)
10. [Жизненный цикл 3D-редактора](#10-жизненный-цикл-3d-редактора)
11. [Формат PCD и конвейер бинарных меток](#11-формат-pcd-и-конвейер-бинарных-меток)
12. [Поток 2D-редактора](#12-поток-2d-редактора)
13. [Серверные методы и REST API](#13-серверные-методы-и-rest-api)
14. [Конфигурация](#14-конфигурация)
15. [Архитектура Docker](#15-архитектура-docker)

---

## 1. Что это

Веб-приложение на **Meteor 1.12 + React 16** для разметки **2D-изображений**
(PNG/JPG/BMP) и **3D-облаков точек** (PCD) с целью создания обучающих датасетов для
ИИ. Изначально разработано Hitachi Automotive & Industry Lab для исследований в
области беспилотного вождения.

Один общий каркас содержит два редактора:

- **2D-редактор** — рисование полигонов поверх растрового изображения средствами
  **Paper.js**.
- **3D-редактор** — отрисовка облака точек и инструменты выделения на **three.js**.

Приложение работает по адресу `http://localhost:3000` (нативный Meteor) или
`http://localhost:8500` (Docker dev).

---

## 2. Технологический стек

```mermaid
graph LR
    SSE(("SSE"))

    SSE --> Runtime["Среда выполнения"]
    SSE --> Frontend["Фронтенд"]
    SSE --> E2D["2D-движок"]
    SSE --> E3D["3D-движок"]
    SSE --> Cross["Сквозная функциональность"]
    SSE --> Data["Кодек данных"]

    Runtime --> R1["Meteor 1.12"]
    Runtime --> R2["Node.js"]
    Runtime --> R3["MongoDB"]

    Frontend --> F1["React 16"]
    Frontend --> F2["Material-UI 4.11"]
    Frontend --> F3["иконки mdi-material-ui"]

    E2D --> P1["Paper.js"]
    E2D --> P2["заливка magic-wand"]

    E3D --> T1["three.js"]
    E3D --> T2["OrbitControls"]
    E3D --> T3["tween.js"]

    Cross --> C1["postal.js — шина pub/sub"]
    Cross --> C2["Mousetrap — клавиатура"]
    Cross --> C3["tippy.js — подсказки"]
    Cross --> C4["jQuery — связка с DOM"]

    Data --> D1["LZW + FastIntegerCompression"]
    Data --> D2["Web Worker — SseDataWorker"]
```

---

## 3. Обзор системы

Браузер общается с сервером Meteor по двум каналам: **DDP** (реактивный
websocket-протокол Meteor — методы и публикации) и **обычный HTTP** (раздача
статики, загрузка бинарных меток, REST API для экспорта).

```mermaid
graph TB
    subgraph Browser["🌐 Браузер (клиент React 16)"]
        Nav["SseNavigatorApp<br/>файловый браузер"]
        Ed2d["SseApp2d / SseEditor2d<br/>Paper.js"]
        Ed3d["SseApp3d / SseEditor3d<br/>three.js"]
        Worker["SseDataWorker<br/>(Web Worker)<br/>кодек LZW + FIC"]
        Bus(("postal.js<br/>шина сообщений UI"))
    end

    subgraph Server["🖥️ Сервер Meteor (Node.js)"]
        Methods["Методы Meteor<br/>getClassesSets · images · saveData"]
        Pubs["Публикации<br/>sse-data-descriptor · sse-labeled-images"]
        API["REST-обработчики (api.js)<br/>/api/json · /api/pcdtext · /api/pcdfile · /api/listing"]
        Files["Файловые обработчики (files.js)<br/>/file · /datafile · /save"]
    end

    Mongo[("MongoDB<br/>SseSamples · SseProps")]
    FS[("Файловая система<br/>images-folder (.pcd/.png)<br/>internal-folder (.labels/.objects)")]

    Nav -- DDP --> Methods
    Ed2d -- DDP --> Methods
    Ed3d -- DDP --> Methods
    Ed2d -- "DDP подписка" --> Pubs
    Ed3d -- "DDP подписка" --> Pubs

    Ed3d -- "HTTP GET /datafile/*.labels" --> Files
    Ed3d -- "HTTP POST /save/*" --> Files
    Ed3d <-- "кодирование/декодирование" --> Worker

    Methods --> Mongo
    Pubs --> Mongo
    Files --> FS
    API --> Mongo
    API --> FS

    Browser -. "все компоненты UI общаются" .- Bus
```

**Ключевая идея:** 2D-разметка хранится в **MongoDB**; 3D-разметка хранится как
**бинарные файлы на диске** (в MongoDB зеркалируются только лёгкие метаданные,
включая выбранный набор классов).

---

## 4. Структура репозитория

```mermaid
graph LR
    root["semantic-segmentation-editor/"]
    root --> client["client/<br/>входная точка, маршруты, стили"]
    root --> imports["imports/<br/>код приложения"]
    root --> server["server/<br/>методы, API, конфиг"]
    root --> lib["lib/<br/>общие коллекции Mongo"]
    root --> public["public/<br/>SseDataWorker.js"]
    root --> scripts["scripts/<br/>entrypoint для Docker"]
    root --> docker["Dockerfile(.dev)<br/>sse-docker-stack*.yml"]

    imports --> common["common/<br/>SseMsg, SseToolbar,<br/>SseClassChooser,<br/>SseSetOfClasses, ..."]
    imports --> editor["editor/<br/>SseEditorApp"]
    imports --> nav["navigator/<br/>SseNavigatorApp, ..."]
    editor --> d2["2d/ + 2d/tools/<br/>редактор на Paper.js"]
    editor --> d3["3d/ + 3d/tools/<br/>редактор на three.js"]
```

| Путь | Назначение |
|------|------------|
| `client/main.js` / `main.html` | Входная точка клиента; монтирует `renderRoutes()` |
| `client/routes.jsx` | Таблица маршрутов React Router |
| `client/main.less`, `layout.css`, `tippy.css` | Стили |
| `lib/collections.js` | Определяет `SseSamples`, `SseProps`; объявляет публикации |
| `server/main.js` | Методы Meteor: `getClassesSets`, `images`, `saveData` |
| `server/api.js` | REST-эндпоинты экспорта |
| `server/files.js` | Раздача статики + загрузка бинарных меток (`/save`) |
| `server/config.js` | Разбирает `Meteor.settings` в готовые пути + карту классов |
| `server/SseDataWorkerServer.js` | Серверное LZW + целочисленное (де)сжатие |
| `public/SseDataWorker.js` | Клиентский Web Worker: тот же кодек, в отдельном потоке |
| `imports/common/` | Общая инфраструктура: шина сообщений, базовый тулбар, выбор классов |
| `imports/editor/2d/` | Полигональный редактор на Paper.js + инструменты |
| `imports/editor/3d/` | Редактор облаков точек на three.js + селекторы |
| `imports/navigator/` | Файловый браузер и список «всё размеченное» |

---

## 5. Маршрутизация

`client/routes.jsx` использует React Router с browser history. Редактор выбирает 2D
или 3D исключительно по расширению файла.

```mermaid
flowchart TD
    A["/"] -->|редирект| B["/browse/0/20/"]
    B["/browse/:fromIndex/:pageLength/:path?"] --> Nav["SseNavigatorApp<br/>(файловый браузер)"]
    C["/edit/:path"] --> EApp["SseEditorApp"]
    D["/annotated"] --> All["SseAllAnnotated<br/>(список размеченных файлов)"]

    EApp -->|"путь оканчивается на .pcd"| ThreeD["SseApp3d (3D)"]
    EApp -->|"иначе"| TwoD["SseApp2d (2D)"]

    Edash["/edit  ·  /edit/"] -->|редирект| B
```

`SseEditorApp` подписывается на публикацию `sse-data-descriptor` для текущего файла
и **ничего не рендерит, пока подписка не готова** (`subReady`). Это гарантирует, что
к моменту монтирования дочернего редактора его дескриптор из MongoDB уже доступен
локально.

```js
// imports/editor/SseEditorApp.jsx (withTracker)
const imageUrl = "/" + props.match.params.path;
const subscription = Meteor.subscribe("sse-data-descriptor", imageUrl);
const subReady = subscription.ready();
const mode = props.match.params.path.endsWith(".pcd") ? "3d" : "2d";
```

---

## 6. Дерево компонентов

Оба каркаса (`SseApp2d`, `SseApp3d`) оборачивают свой редактор в провайдер темы
Material-UI и окружают его тулбарами, выбором классов и статус-барами.

```mermaid
graph TD
    EApp["SseEditorApp<br/>(withTracker → subReady, mode)"]
    EApp --> App3d["SseApp3d"]
    EApp --> App2d["SseApp2d"]

    subgraph S3["3D-каркас"]
        App3d --> TB3["SseToolbar3d"]
        App3d --> CC3["SseClassChooser"]
        App3d --> ED3["SseEditor3d ⭐ ядро"]
        App3d --> CAM["SseCameraToolbar"]
        App3d --> OBJ["SseObjectToolbar"]
        App3d --> BB3["SseBottomBar"]
        App3d --> TT3["SseTooltips3d"]
    end

    subgraph S2["2D-каркас"]
        App2d --> TB2["SseToolbar2d"]
        App2d --> CC2["SseClassChooser"]
        App2d --> ED2["SseEditor2d ⭐ ядро"]
        App2d --> LAY["SseLayers"]
        App2d --> SLD["SseSliderPanel"]
        App2d --> BB2["SseBottomBar"]
    end

    App3d -.->|"Meteor.call getClassesSets"| CS["SseSetOfClasses[]"]
    App2d -.->|"Meteor.call getClassesSets"| CS
```

Большинство интерактивных компонентов наследуются от **`SseToolbar`**, который в
конструкторе вызывает `SseMsg.register(this)` и подключает горячие клавиши
(Mousetrap) и подсказки (tippy). Именно так клик по любой кнопке превращается в
сообщение на общей шине.

---

## 7. Шина сообщений (SseMsg / postal.js)

Компоненты **не** вызывают друг друга напрямую. Они публикуют/подписываются на
именованные сообщения в одном канале postal.js (`ui` / топик `msg`).
`SseMsg.register(obj)` добавляет любому объекту методы `sendMsg`, `onMsg`,
`forgetMsg` и `retriggerMsg`.

```mermaid
sequenceDiagram
    participant Toolbar as SseToolbar3d
    participant Bus as postal.js (ui/msg)
    participant Chooser as SseClassChooser
    participant Editor as SseEditor3d

    Note over Toolbar,Editor: Все трое вызвали SseMsg.register(this)

    Toolbar->>Bus: sendMsg("rectangle")
    Bus-->>Editor: actions["rectangle"](arg)
    Editor->>Editor: переключить инструмент выделения

    Chooser->>Bus: sendMsg("active-soc", {value: soc})
    Bus-->>Editor: actions["active-soc"](arg)
    Bus-->>Chooser: actions["active-soc"](arg)
    Note right of Bus: срабатывает каждый подписчик<br/>с подходящим обработчиком onMsg

    Editor->>Bus: sendMsg("class-instance-count", {classIndex, count})
    Bus-->>Chooser: обновить счётчики по классам (бейдж <sup>)
```

Полезные детали:

- **Синхронная доставка.** `postal.publish` вызывает подписчиков немедленно,
  поэтому вызовы `setState` внутри обработчика `onMsg` батчатся вместе с исходным
  обработчиком события React.
- **`retriggerMsg(key)`** повторно проигрывает *последнее* сообщение с данным именем
  — удобно для компонента, смонтированного позже, которому нужно текущее состояние
  (например, повторно применить активный набор классов). `SseMsg` хранит для этого
  статическую карту `lastMessages`.
- **Отписывайтесь при размонтировании** через `SseMsg.unregister(this)`, чтобы
  избежать утечек.

Неполная карта самых активных 3D-сообщений:

| Сообщение | Отправитель → Получатель | Смысл |
|-----------|--------------------------|-------|
| `editor-ready` | Editor → ClassChooser | редактор смонтирован; несёт сохранённый `socName` (или его нет) |
| `active-soc` | ClassChooser → Editor | сменился активный набор классов |
| `classSelection` / `classIndex-select` | оба → оба | сменился индекс активного класса |
| `class-instance-count` | Editor → ClassChooser | число точек по классу (бейджи в сайдбаре) |
| `rectangle` / `circle` / `selector` | Toolbar → Editor | переключить инструмент выделения |
| `selection-changed` | Editor → тулбары | изменилось множество выделения |
| `object-new` / `object-select` / `object-delete` | Toolbar ↔ Editor | жизненный цикл объекта (экземпляра) |
| `rgb-toggle` / `point-size` / `color-boost` | Toolbar → Editor | параметры отрисовки |

---

## 8. Наборы классов

**Набор классов** (set of classes, SOC) — это именованный список дескрипторов
меток. `getClassesSets` (сервер) читает их из `settings.json` и автоматически
назначает цвета (через `color-scheme`) тем дескрипторам, у которых цвет не указан.
На клиенте каждая «сырая» конфигурация оборачивается в экземпляр
**`SseSetOfClasses`**, предоставляющий преобразования индекс ↔ метка ↔ цвет.

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
        +icon   (опционально, имя mdi)
        +classIndex  (= позиция в массиве)
    }
    SseSetOfClasses "1" *-- "many" Descriptor : objects[]
```

**`classIndex` — это просто позиция** дескриптора в массиве `objects` набора. По
соглашению **индекс 0 — это фоновый/пустой класс (background/void)**. Именно поэтому
горячая клавиша `Delete`/`D` в 3D-редакторе присваивает выделению класс `0` — она
«стирает» точки обратно в фон.

---

## 9. Модель данных и хранение

Две коллекции (`lib/collections.js`), общие для клиента и сервера:

```mermaid
erDiagram
    SseSamples {
        string url "первичный ключ (путь к файлу)"
        string folder
        string file
        string socName "выбранный набор классов"
        array  objects "2D-полигоны ИЛИ 3D-экземпляры объектов"
        array  tags
        date   firstEditDate
        date   lastEditDate
    }
    SseProps {
        string key "например, 'tags'"
        array  value
    }
```

**Путь хранения различается по типу редактора:**

```mermaid
flowchart LR
    subgraph TwoD["2D-разметка"]
        P2["полигоны с classIndex"] -->|"Meteor.call saveData"| M2[("SseSamples<br/>objects[] = полигоны")]
    end

    subgraph ThreeD["3D-разметка"]
        L3["массив classIndex по точкам"] -->|"HTTP POST /save"| F1[("файл .labels<br/>сжатый")]
        O3["экземпляры объектов"] -->|"HTTP POST /save"| F2[("файл .objects<br/>сжатый")]
        Meta["{url, socName, ...}"] -->|"Meteor.call saveData"| M3[("SseSamples<br/>только метаданные")]
    end
```

- **2D** хранит саму геометрию полигонов внутри документа Mongo
  (`objects[].polygon`, `classIndex`, `layer`).
- **3D** держит в Mongo только **метаданные** (прежде всего `socName`, чтобы при
  перезагрузке восстановить выбранный набор классов). Тяжёлые данные по точкам лежат
  в двух бинарных файлах в *internal-folder*: `*.pcd.labels` (один индекс класса на
  точку) и `*.pcd.objects` (группировка по экземплярам).

---

## 10. Жизненный цикл 3D-редактора

Это поток, который реализует «открыть облако → выбрать набор классов → размечать →
сохранять», включая обязательный выбор набора при первом открытии.

```mermaid
sequenceDiagram
    autonumber
    participant URL as Router (/edit/...pcd)
    participant App as SseApp3d
    participant Ed as SseEditor3d
    participant CC as SseClassChooser
    participant Mongo as MongoDB (SseSamples)
    participant Disk as internal-folder

    URL->>App: монтирование (subReady гарантирован)
    App->>Mongo: Meteor.call getClassesSets
    Mongo-->>App: наборы → SseSetOfClasses[]
    App->>Ed: рендер с classesSets
    App->>CC: рендер с classesSets

    Ed->>Mongo: findOne({url}) → pendingServerMeta
    Ed->>CC: sendMsg("editor-ready", {socName})

    alt socName есть (повторный визит)
        CC->>Ed: sendMsg("active-soc", {разрешённый SOC})
    else записи нет (первый визит)
        CC->>CC: показать ОБЯЗАТЕЛЬНЫЙ модал выбора набора
        Note over CC: пользователь обязан выбрать набор (без отмены)
        CC->>Ed: sendMsg("active-soc", {выбранный SOC})
    end

    Ed->>Ed: start() — meta.socName = activeSoc.name
    Ed->>Mongo: saveMeta() (сразу сохранить socName)
    Ed->>Disk: GET *.labels / *.objects (если есть)
    Disk-->>Ed: декомпрессия через Web Worker → classIndex по точкам
    Ed->>Ed: display() — раскрасить точки по классам
    Ed->>CC: class-instance-count по каждому классу (бейджи сайдбара)

    loop пользователь размечает
        Ed->>Ed: выделить точки → assignNewClass(idx, classIndex)
        Ed->>Disk: POST /save *.labels (+ *.objects)
        Ed->>Mongo: saveMeta()
    end
```

Машина состояний модала выбора классов:

```mermaid
stateDiagram-v2
    [*] --> Empty: soc = null
    Empty --> Required: editor-ready БЕЗ socName
    Empty --> Active: editor-ready С socName
    Required --> Active: пользователь выбрал набор (active-soc)
    Active --> ChangeMenu: клик «Classes Sets»
    ChangeMenu --> Active: выбор / отмена
    Active --> [*]
```

> Метод `display()` всегда присваивает `classIndex` каждой точке *до* построения
> буфера цвета, независимо от переключателя отображения RGB. Это критично:
> `updateClassFilter()` читает `classesData[pt.classIndex].visible`, поэтому
> отсутствующий `classIndex` приведёт к падению. См. [`CHANGES.md`](./CHANGES.md).

---

## 11. Формат PCD и конвейер бинарных меток

### Разбор PCD

`SsePCDLoader` — это урезанный `PCDLoader` из three.js (только ASCII PCD), который
извлекает поля заголовка (`FIELDS x y z rgb label object`), позиции, опциональный
`rgb`, метки и идентификаторы объектов.

### Зачем Web Worker

Массив меток для облака из миллиона точек большой. Сжатие/декомпрессия выполняются в
**`public/SseDataWorker.js`** (Web Worker), чтобы UI-поток никогда не блокировался.
Идентичный кодек существует и на сервере в `SseDataWorkerServer.js` для API
экспорта.

```mermaid
flowchart TD
    subgraph Save["Сохранение .labels (клиент → диск)"]
        A["cloudData[].classIndex<br/>(массив int)"] --> B["SseDataWorker<br/>строковое кодирование LZW"]
        B --> C["FastIntegerCompression<br/>целые переменной длины"]
        C --> D["ArrayBuffer"]
        D -->|"POST /save/<path>.labels<br/>(application/octet-stream)"| E[("файл .labels")]
    end

    subgraph Load["Загрузка .labels (диск → клиент)"]
        F[("файл .labels")] -->|"GET /datafile/<path>.labels"| G["ArrayBuffer"]
        G --> H["декомпрессия FIC"]
        H --> I["декодирование LZW"]
        I --> J["массив int → classIndex по точкам"]
    end
```

Кодек состоит из двух стадий:

1. **LZW** — словарное сжатие строк (`SseDataManager.LZW`).
2. **FastIntegerCompression (FIC)** — кодирование потока кодов LZW целыми переменной
   длины (1–5 байт на целое в зависимости от величины).

`server/files.js` записывает загруженные буферы через `createWriteStream`. Он
использует `path.join` (исключает двойные слэши) и обработчик
`wstream.on('error', …)`, чтобы ошибка файловой системы `EPERM` возвращала HTTP 500,
а не роняла процесс Node.

---

## 12. Поток 2D-редактора

2D-редактор рисует полигоны на холсте Paper.js. Каждый инструмент
(`SsePolygonTool`, `SseFloodTool` / волшебная палочка, `SseCutTool`,
`SseRectangleTool`, `SsePointerTool`) наследуется от `SseTool` и получает
обработчики мыши/клавиатуры.

```mermaid
flowchart LR
    Tool["активный инструмент<br/>(Polygon / Magic / Cut / ...)"] --> Path["Paper.js Path<br/>(сегменты)"]
    Path --> Feature["feature {classIndex, layer}"]
    Feature -->|saveData| Sample["currentSample.objects[]"]
    Sample -->|"Meteor.call saveData"| Mongo[("SseSamples")]
    Undo["SseUndoRedo2d"] -. снимки .- Path
    Layers["SseLayers"] -. показать/скрыть/упорядочить .- Path
```

При `saveData` каждый путь сериализуется в объект
`{classIndex, layer, polygon:[[x,y]…]}`, и весь `currentSample` записывается
(upsert) в `SseSamples` через метод `saveData`.

---

## 13. Серверные методы и REST API

### Методы Meteor (`server/main.js`)

```mermaid
flowchart TD
    GCS["getClassesSets()"] --> CFG["'sets-of-classes' из настроек<br/>+ автоцвета (color-scheme)"]
    IMG["images(folder, page, len)"] --> DIR["readdir imagesFolder<br/>→ папки + страница изображений"]
    SAVE["saveData(sample)"] --> UP["SseSamples.upsert({url}, sample)<br/>проставляет folder/file/даты, tags→SseProps"]
```

| Метод | Назначение |
|-------|------------|
| `getClassesSets()` | Возвращает все наборы меток с заполненными цветами |
| `images(folder, pageIndex, pageLength)` | Постраничный листинг директории для навигатора |
| `saveData(sample)` | Upsert документа-образца (2D-полигоны *или* 3D-метаданные) |

### REST API (`server/api.js`, монтируется через `WebApp.connectHandlers`)

```mermaid
graph LR
    C1["GET /api/listing"] --> R1["все размеченные файлы (JSON)"]
    C2["GET /api/json/&lt;path&gt;"] --> R2["2D-полигоны с разрешёнными метками"]
    C3["GET /api/pcdtext/&lt;path&gt;"] --> R3["размеченный PCD как ASCII (inline)"]
    C4["GET /api/pcdfile/&lt;path&gt;"] --> R4["размеченный PCD как ASCII (скачивание)"]
```

`/api/pcdtext` и `/api/pcdfile` заново склеивают исходный `.pcd`, распакованный
`.labels` и группировку `.objects` в единый ASCII PCD с полями
`FIELDS x y z [rgb] label object`. `/api/json` разрешает `classIndex` каждого
полигона в человекочитаемую метку, используя `socName` образца (с защитой от
отсутствующего набора или индекса).

---

## 14. Конфигурация

`settings.json` (или альтернативный файл вроде `room_labels_new.json`) управляет
всем. `server/config.js` разбирает его один раз при старте.

```mermaid
flowchart TD
    S["settings.json"] --> CFG["server/config.js init()"]
    CFG --> IF["imagesFolder<br/>(images-folder или ~/sse-images)"]
    CFG --> PF["pointcloudsFolder<br/>(internal-folder или ~/sse-internal)"]
    CFG --> MAP["setsOfClassesMap<br/>(имя → конфиг SOC)"]
    IF -.->|"нет папки → создать + скачать примеры"| DL["sample png + pcd с GitHub"]
```

| Ключ | Смысл | По умолчанию |
|------|-------|--------------|
| `configuration.images-folder` | Корневая папка, отдаваемая навигатору | `$HOME/sse-images` |
| `configuration.internal-folder` | Где хранятся `.labels` / `.objects` | `$HOME/sse-internal` |
| `configuration.demo-mode` | Если true, `saveData` и `/save` ничего не делают | — |
| `sets-of-classes` | Массив именованных наборов меток (`label` обязателен; `color`, `icon` опциональны) | встроенный «33 Classes» |

---

## 15. Архитектура Docker

Два compose-стека используют одно семейство образов.

```mermaid
graph TB
    subgraph Dev["sse-docker-stack.dev.yml (разработка)"]
        DApp["app (Dockerfile.dev)<br/>репозиторий смонтирован в /opt/src<br/>entrypoint: docker-dev-entrypoint.sh"]
        DMongo["mongo:7.0"]
        DVols["именованные тома:<br/>node_modules · .meteor/local<br/>кеш сборки · кеш npm · БД"]
        DApp --> DMongo
        DApp -.-> DVols
    end

    subgraph Prod["sse-docker-stack.yml (продакшн)"]
        PApp["app (готовый образ,<br/>без bind-маунтов)"]
        PMongo["mongo"]
        PApp --> PMongo
    end
```

### Логика сборки dev-entrypoint

Entrypoint **снимает контентный отпечаток исходников** и пропускает `meteor build`,
когда ничего не изменилось, а также **складывает `node_modules` серверного бандла по
хешу `npm-shrinkwrap.json`**, чтобы при пересборке восстановить их через хардлинки
(секунды) вместо переустановки (~10 мин).

```mermaid
flowchart TD
    Start["старт / рестарт контейнера"] --> Deps{"node_modules есть?"}
    Deps -- нет --> Install["meteor npm install"]
    Deps -- да --> FP
    Install --> FP["вычислить отпечаток исходников"]
    FP --> Mode{"SSE_HOT_RELOAD == 1 ?"}
    Mode -- да --> Hot["meteor run<br/>(долгая первая компиляция, hot reload при сохранении)"]
    Mode -- нет --> Changed{"отпечаток изменился<br/>или SSE_FORCE_REBUILD?"}
    Changed -- нет --> Restore["восстановить серверные зависимости из стеша<br/>запустить кешированный бандл"]
    Changed -- да --> Build["meteor build → застешить серверные зависимости → запустить бандл"]
    Restore --> Run["node main.js (PORT 3000 → 8500)"]
    Build --> Run
    Hot --> Run
```

Именованные тома держат `node_modules` и `.meteor/local` **нативными для Linux**, что
важно на macOS / Apple Silicon, где образ запускается под эмуляцией amd64. Логи
сборки лежат в `/var/cache/borovets-sse-meteor-build/meteor-build.log` внутри
контейнера.

| Команда | Эффект |
|---------|--------|
| `docker compose -f sse-docker-stack.dev.yml build` | Собрать dev-образ (выполняет `meteor npm install`) |
| `… up` | Запуск; собирает при старте контейнера |
| `… restart app` | Применить изменения JS/JSX/Less (сборка только если исходники изменились) |
| `SSE_FORCE_REBUILD=1 … restart app` | Принудительная полная пересборка + npm install сервера |
| `SSE_HOT_RELOAD=1 … up` | Классический hot reload при сохранении |
| `… down` / `down -v` | Остановить (сохранив тома) / стереть все кеши и данные |

---

*Диаграммы написаны на [Mermaid](https://mermaid.js.org/) и нативно рендерятся на
GitHub и в большинстве просмотрщиков Markdown.*
