# Chirp Hub — Electron app design record

The complete design for the desktop app that onboards cameras, LoRaWAN and Zigbee/Thread without a
terminal. **Read this before changing anything under `app/`.**

Related: [../CLAUDE.md](../CLAUDE.md) (repo-wide context and the documentation map) ·
[../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) (what is built) ·
[../docs/zigbee-thread.md](../docs/zigbee-thread.md) · [../docs/ubuntu-2604.md](../docs/ubuntu-2604.md)

---

## 1. Why this exists

The image has working LoRaWAN, Zigbee and Thread plumbing, but all of it is driven from a terminal. The
people this product is for do not use terminals. The app's hardest job is **camera Twins**: a Twin is one
Docker container per camera, and asking a normal person to install Docker and hand-roll containers is a
non-starter.

One app, every platform, managing that machine's own Docker:

| Installed on | Cameras | Zigbee / Thread | LoRaWAN gateway |
|---|---|---|---|
| Raspberry Pi (with the HAT) | yes | yes | **yes** |
| Windows / macOS / Linux desktop | yes | yes (USB dongle) | no radio — empty state explains why |

**Decisions already taken, with their reasons:**

| Decision | Why |
|---|---|
| No agent, no remote protocol — Electron manages **local** Docker | The Pi gets a screen. A remote-control architecture would be over-engineering |
| **Nothing is written in Go** | `dockerode` for containers, `serialport` for dongles, shell out to the existing `detect-radios.sh` / `detect-concentrator.sh`. A Go sidecar would be a second toolchain for no gain |
| **TinyGo ruled out** | It targets microcontrollers and WASM with a cut-down stdlib, no full reflection, limited networking. A Pi 4 is a full Go target anyway, so the question never arises |
| Twin ships as a **downloadable image tarball** from a public link | Keeps Twin's source closed without pushing users into a private registry |
| Guided Docker install, **never silent** | Docker Desktop needs a paid licence above 250 staff or $10M revenue. A silent install could put a business user in breach unknowingly |
| Camera capacity **measured, not guessed** | The only published figures are K8s requests that predate the cgo ffmpeg motion-detection path |

---

## 2. The three contracts

Every phase of work restates the part of each contract it must satisfy. Stated once at the top of a long
plan, they stop influencing the work several phases later — so they are repeated deliberately.

### Contract 1 — SOLID

| | Rule | Enforcement |
|---|---|---|
| **S** | One use case = one operation = one directory | `camera-add` creates a Twin; it does not discover, remove or update. A use case needing a second verb in its name is two use cases |
| **O** | Extend by **registry entry**, never by editing a `switch` | New Zigbee dongle = a table row. New camera vendor = a `SourceProfile` entry. Adding hardware must touch no existing file |
| **L** | One contract per port | `DockerRuntime` and a future `PodmanRuntime` substitutable with no use case aware |
| **I** | Narrow ports | `CameraDiscoveryPort`, `ContainerRuntimePort`, `ImageStorePort`, `PrivilegedRunnerPort`, `ChirpDevicePort`, `PathsPort`. **Never** one `SystemPort` god interface |
| **D** | Ports declared by the **consuming use case**, implemented in `adapters/`, wired only in `index.ts` | The same consumer-side-interface rule the monorepo's Go services follow |

**The test that keeps it honest:** every use case must be unit-testable with fake ports — no Docker, no
camera, no network, no Electron. If one cannot be, the layering is wrong; fix the layering, don't mock
harder.

**CI fails on** (see `scripts/check-boundaries.ts`):

1. any `domain/` file importing outside `domain/`
2. any `usecase/` file importing from `adapters/`, `electron`, or Node built-ins
3. any renderer file importing from `main/`, `dockerode`, or using `require(`
4. any use case directory without a `usecase.test.ts`

### Contract 2 — the non-technical user

The user has never opened a terminal and does not know what a container, MQTT, EUI, RTSP or a
coordinator is.

| | Rule | Worked example |
|---|---|---|
| 1 | **No jargon in the primary path** | Progress says `Connecting to your camera…`, never `Starting container lens-twin-3`. "Cameras", not "Twins". The word "container" appears nowhere in the UI |
| 2 | **Never show a raw error** | `ECONNREFUSED 192.168.2.40:554` becomes "Can't reach the camera at 192.168.2.40. Check it's powered on and on the same network. `[Try again]`". Raw text stays behind `[Technical details]` for support |
| 3 | **Sensible defaults; nothing asked that can be detected** | The gateway EUI is read from the chip, never typed. The Zigbee adapter type comes from the USB descriptor. The LNS URL is derived from the region. The region is defaulted from system locale |
| 4 | **Every screen states the next action** | Exactly one primary button. "No cameras yet… `[Scan for cameras]`" — an empty state that does not say what to do next is a bug |
| 5 | **Show proof it worked** | A captured frame from *their* camera. `[Identify]` blinking *their* bulb. An uplink counter ticking up. Non-technical users trust what they can see, not a green tick |
| 6 | **Never leave them stuck** | Every failure offers a retry, a fallback, or `[Export diagnostics]` — which produces one redacted zip a support engineer can read |

### Contract 3 — portability (Ubuntu Core readiness)

**Ubuntu Core is snap-based, not Docker-based.** Read-only root, no `apt`, transactional updates with
automatic rollback, strict confinement, and hardware reached through gadget-snap slots (`gpio-chardev`,
`spi`, `i2c`, `serial-port`, `custom-device`). Docker runs there, but as a confined snap — it is not the
foundation.

Moving there is a goal, not a commitment. Four rules keep the cost low, and three of them fall out of
Contract 1 anyway:

1. **No hardcoded system paths in the app.** `/etc/iot-hub`, `/usr/local/bin`, `/var/lib/iot-hub` all come
   from `PathsPort`, resolved at composition. On Core they become `$SNAP_DATA` / `$SNAP_COMMON`.
2. **All privileged operations behind `PrivilegedRunnerPort`.** Today pkexec/UAC; on Core, interface
   connections. No use case shells out directly, ever.
3. **All container operations behind `ContainerRuntimePort`.** The Docker snap is confined and its data
   lives elsewhere; a use case must not care.
4. **The UI must work fullscreen with no window chrome.** Core has no desktop — only Ubuntu Frame, a
   Wayland kiosk compositor. So: in-app back navigation and title, touch-friendly targets, 1024×600
   minimum, nothing relying on a menu bar or on other windows existing.

| Survives a Core move untouched | Gets replaced |
|---|---|
| `domain/`, every use case, every port | `install-*.sh` → `snapcraft.yaml` |
| the renderer and the ui-kit integration | udev rules → gadget-snap slots |
| the IPC contract | systemd units → snap daemons |
| | `dtparam=spi=on` → a custom gadget snap |
| | labwc → Ubuntu Frame |

**Prerequisites when the time comes** (not this project): a **custom gadget snap** for the RAK HAT's SPI
and device tree, and a Canonical **brand store** for a commercial product with auto-connecting interfaces.

### Contract 4 — single source of truth, nothing hardcoded

Every value that appears in more than one place, or that anyone might reasonably want to change later,
has **exactly one definition**. This is not tidiness — it is what makes rebranding, re-pointing at a
different cloud, or translating the app a one-file change instead of an archaeology exercise.

| Kind of value | The one source of truth | Never |
|---|---|---|
| Colors, spacing, radii, shadows, typography | ui-kit `getTheme({ variant: 'chirp' })` + the `chirpPalette` cast | A hex code, `rgba(...)`, or a raw `px` in a component. `sx={{ color: 'primary.accent' }}`, not `#FF4D14` |
| Breakpoints | the theme's `xs sm md xm lg xl xxl` | A hardcoded `@media (max-width: 768px)` |
| User-facing text | `renderer/locales/<lang>/*.json` | A string literal in JSX. Every sentence in this document's screen specs is a translation key |
| Ports, timeouts, retry counts, poll intervals | `main/config/defaults.ts` | A `5000` inline. Named constants with a comment saying *why* that number |
| Container image tags and digests | `main/config/images.ts` | A tag typed into a compose file *and* a use case |
| Filesystem paths | `PathsPort` (Contract 3) | `/etc/iot-hub/...` anywhere outside the adapter |
| IPC channel names | one typed channel map shared by `preload` and `main/ipc` | A magic string at each end that can drift apart |
| API request/response shapes | one zod schema per payload; TypeScript types via `z.infer` | A hand-written `interface` next to a schema that says the same thing twice |
| Supported hardware (dongles, adapters, camera vendors) | one registry data file each | A `switch` — this is also Contract 1's **O** |
| Chirp/Lens endpoints and the LNS URL pattern | `main/config/endpoints.ts` | A URL built inline in three different use cases |
| Capacity thresholds | the measured table as data, behind `CapacityAdvisorPort` | A number in a React component |

**Why the theme specifically:** the app must match Chirp branding and follow it when it changes. The
ui-kit already carries the palette, and it supports a `chirp` variant plus light/dark. A single hex code
committed into a component is a color that will be wrong after the next rebrand and will not be found by
searching for the new one.

**Enforced in CI** by `app/scripts/check-boundaries.ts` alongside the layering rules:

- no hex or `rgb()/rgba()` literals in `renderer/` outside the theme setup file
- no raw `px` values in `sx`/`styled` outside `theme.spacing()` — spacing is `4` in this theme, so
  `theme.spacing(2)` is 8px and the numbers stay consistent
- no bare string literals as JSX text nodes (they belong in `locales/`)
- no `/etc/`, `/usr/local/`, `/var/lib/` outside `adapters/paths/`
- no container image tag string outside `main/config/images.ts`

Localisation follows from this for free: because every string is already a key, adding a language is a
new JSON file. The ui-kit ships `en, de, fr, es, ru, pt` under the `uiKit` namespace, merged into the
app's i18next instance the same way `chirp-frontend` does it.

### Contract 5 — Chirp frontend conventions

Source: **`chirp-frontend/CLAUDE.md`**. Anyone moving between the web app and this desktop app should
write the same code, so the same rules apply here.

**Layered architecture in the renderer.** The renderer gets the same four layers the web app uses, which
sits directly on top of the main-process ports:

```
Component (View) → useFeatureLogic (Business) → useEntityQuery/Mutation (Cache) → window.chirpHub.* (IPC)
                                                                                        ↓
                                                                   main: use case → ports → adapters
```

- Components render JSX and wire events. **No `useQuery` and no IPC call inside a component.**
- Business hooks (`{feature}/hooks/`) hold domain logic and orchestrate cache hooks.
- Cache hooks (`services/api/{module}/hooks/`) wrap TanStack Query and own cache keys and invalidation.
- The transport layer is plain functions over `window.chirpHub`.

| Rule | Detail |
|---|---|
| **Named exports only** | No default exports, and therefore no `displayName` |
| **No `any`** | Not even `as any`. Use `unknown` plus a type guard |
| **i18n: key = English text** | Not a dotted identifier. A missing translation then degrades to readable English rather than leaking `pages.zigbee.title` into the UI |
| **All five languages** | `en`, `de`, `es`, `fr`, `pt`, in `locales/resources/{namespace}.json`, keyed by language first |
| **UI-kit import boundary** | `Button`, `IconButton`, `TextField`, `Checkbox`, `Switch`, `Tabs`, `Tab`, `Tooltip`, `Dialog`, `Modal`, `Table`, `Autocomplete` come from `@chirpwireless/ui-kit/primitives`, **never** `@mui/material`. Layout/typography (`Box`, `Stack`, `Typography`, `Grid`, `Divider`, …) may come from MUI directly. Only `style.ts(x)` files are exempt |
| **Page layout** | `PageWrapper`, a `StackRowJB` header row with `Typography variant='h2'`, a 24px-gap body Stack |
| **Modals** | Conditional rendering — `{isOpen ? <Dialog … /> : null}` — not an `open` prop |
| **Naming** | `handle{Action}` for handlers, `use{Entity}{Action}Query` / `…Mutation` for hooks |
| **One component per file** | Extract sub-components; lift reusable helpers to module scope or `helpers/` |
| **`useEffect` last** | Hooks → derived values → handlers → `useEffect` → `return`. Prefer doing the work in the handler over reacting to state |
| **Prettier is the source of truth** | Single quotes including JSX attributes, semicolons, 2-space indent, `es5` trailing commas, `printWidth` 120, always-parenthesised arrow params. Config copied verbatim from chirp-frontend |
| **Linter: oxlint, not ESLint** | See below — ESLint cannot run here at all |
| **Import order** | builtin/external → internal aliases → relative, blank line between groups, alphabetised within |
| **Comments** | English, only where there is business logic, and they explain **why** |

### The linter: oxlint, because ESLint cannot run on TypeScript 7

`typescript-eslint` peers `>=4.8.4 <6.1.0`. TypeScript **7.0.2 is the current stable release** (and
typechecks this whole stack cleanly), while TypeScript 6 is still beta — so typescript-eslint supports
neither, and without its parser ESLint cannot read a `.ts` file at all.

**oxlint** solves it: Rust-based with its own parser, it never invokes `tsc`, so the TypeScript version
is irrelevant to it. It reads ESLint-v8-style config, so the rules transfer almost verbatim, and it runs
in milliseconds. It enforces the rules that matter here — `typescript/no-explicit-any`,
`import/no-default-export`, `no-restricted-imports` (the ui-kit and MUI-primitive boundaries),
`react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`.

Four rules are switched off deliberately, each for a concrete reason: `react/react-in-jsx-scope` (React
19 uses the automatic JSX runtime), the three `react-perf/jsx-no-new-*` rules (`sx={(theme) => …}` is the
idiomatic MUI pattern, not a performance bug), `import/no-unassigned-import` (`fonts.css` is a deliberate
side-effect import) and `unicorn/require-module-specifiers` (`export {}` is required to make a `.d.ts` a
module for `declare global`).

`eslint.config.js.pending` is kept so ESLint is one `npm install` away once typescript-eslint catches up.

**Deviations from chirp-frontend, and why:**

| | chirp-frontend | Here |
|---|---|---|
| Package manager | Yarn 1 | **npm** with `legacy-peer-deps`. Yarn 1 only tolerates the ui-kit's self-contradictory peers by accident; `legacy-peer-deps` states the intent explicitly. Electron tooling is npm-first |
| MUI | v7 | **v9** (the ui-kit v1.0.0 peer). v9 **removed system props from `Stack`**, so the documented `<Stack gap='24px' width='100%'>` does not compile — the same values go through `sx` |
| Router | v6 | v6 — unchanged, and pinned because the ui-kit peer requires it |
| Language of user communication | Russian | English, matching this repo |

---

## 3. Architecture

Three processes, strict boundaries. The renderer never touches Node: `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`. All privilege sits in main behind a typed IPC contract.

```
app/src/
├── main/
│   ├── domain/      entities + errors. ZERO imports from adapters/usecase/electron
│   │                camera.ts gateway.ts radio.ts zigbee-device.ts host.ts errors.ts
│   ├── usecase/     one directory per operation:
│   │                  contract.ts   ports this use case needs (declared HERE, not in adapters)
│   │                  usecase.ts    orchestration
│   │                  usecase.test.ts  fakes only — no Docker, no network
│   ├── adapters/    container/ discovery/ chirp/ lens/ mqtt/ privileged/ store/ paths/
│   ├── ipc/         one handler per use case — the ONLY main↔renderer surface
│   └── index.ts     composition root: the only file naming concrete types
├── preload/         contextBridge, typed channel map
└── renderer/        React + ui-kit. No Node, no Docker, no fs
```

### Use cases

`host-capabilities` · `docker-ensure` · `gateway-detect` · `gateway-register` · `gateway-provision` ·
`zigbee-start` · `zigbee-permit-join` · `zigbee-device-list` · `zigbee-device-link-chirp` ·
`thread-start` · `twin-image-ensure` · `camera-discover` · `camera-add` · `camera-remove`

Three separate gateway use cases because they fail independently, and a user may legitimately do only the
third (manual certificate upload). Four separate Zigbee use cases rather than one `ZigbeeService` because
`Zigbee2MqttPort` (local radio) and `ChirpDevicePort` (cloud) must stay distinct — the entire
troubleshooting story depends on knowing which of the two failed.

---

## 4. Stack

| | Version | Note |
|---|---|---|
| Electron | 43.2.0 | |
| electron-vite / -builder / -updater | 5.0.0 / 26.15.3 / 6.8.9 | |
| React + React DOM | 19.2.8 | ui-kit peer |
| @mui/material | 9.2.0 | ui-kit peer |
| @chirpwireless/ui-kit | 1.0.0 | git dependency **pinned to a commit SHA**; `dist/` is committed, so no registry auth |
| TanStack Query / zod / dockerode | 5.101.4 / 4.4.3 / 5.0.1 | zod validates every IPC and HTTP boundary |
| Vite / Vitest / TypeScript | 8.2.0 / 4.1.10 / **7.0.2** | TS 7 verified against the real stack before pinning — see below |

**Two deliberate exceptions to "use the latest version", both forced by ui-kit peer ranges:**

- `react-router-dom` **6.30.4**, not 7.18.2 — ui-kit's peer is `^6.26.1`
- `date-fns` **2.x**, not 4.x — ui-kit's peer is `^2.30.0`

Using the newest would break the kit. Do not "fix" these. **Everything else is on the current latest.**

### TypeScript 7 — tested, not assumed

The earlier draft of this document said "fall back to 5.x if MUI v9 types misbehave". That fallback was
**not needed and must not be applied without new evidence.** Verified 2026-08-01 against the real stack —
TS 7.0.2 (the stable `latest` tag, not a preview) with MUI 9.2.0, React 19.2.8, `@types/react` 19.2.18
and the ui-kit installed from its committed `dist/`:

- MUI v9 `createTheme`, `ThemeProvider`, `sx` callbacks reading theme tokens — clean
- React 19 hooks and generic components under `strict` + `noUncheckedIndexedAccess` — clean
- ui-kit subpath imports (`/primitives`, `/shell`, `/theme`) — clean
- the **37 ui-kit `dist/*.d.ts` files that import via `../../node_modules/@mui/material/...`** — covered
  by `skipLibCheck: true`, which is why that flag is set in both tsconfigs and should stay

Total: **zero type errors**. The only error the probe produced was genuine API misuse on my side —
ui-kit's `Button` requires `size` and `variant` — which is the type system working, not failing.

### ui-kit gotchas — all three cost real time if rediscovered

1. **`dist/style.css` references fonts that are not in `dist/`.** The `@chirp/ui` Vite alias was never
   resolved by the CSS build, so you get four dead `@font-face` rules and an Arial fallback. Copy the
   woff2 files from `ui-kit/src/assets/fonts/` into the app and declare our own `@font-face`.
2. **Never import the kit's root entry.** It re-exports `helpers/map-utils.ts`, which reads
   `import.meta.env`. Import only `/shell`, `/primitives`, `/theme`, `/icons`, `/locales`.
3. **`chirpPalette` is not exported** — no `./theme/palette` subpath exists. Re-declare the one-line cast
   locally.

Theme: `getTheme({ mode, variant: 'chirp' })`. Persist the mode in `electron-store`, **not** the cookie
helper the web app uses — there is no domain under `file://`.

Routing: **`HashRouter`**. `BrowserRouter` breaks under `file://`. `Sidebar` takes an injectable
`linkComponent`, which is the intended seam.

---

## 5. What the app automates vs what it asks

This table *is* the product.

| Automated — the user never sees or types it | Asked — genuinely cannot be known |
|---|---|
| Gateway EUI — read from the concentrator chip | Chirp sign-in |
| Zigbee adapter type (`ember`/`zstack`/`deconz`) — from the USB descriptor | Gateway name (pre-filled) |
| LNS URL — derived from the region | Region (defaulted from locale) |
| Region default — from system locale | *(Camera credentials are set in the Twin, not here)* |
| Camera discovery — ONVIF WS-Discovery | *(Camera name is asked by the Twin, not here)* |
| Certificate download, unzip, CRLF fix, install | The physical pairing action on the Zigbee device |
| Docker install | Zigbee device display name |
| Twin image download, SHA-256 verify, `docker load` | Confirm the proposed sensor mappings |
| Twin first-login password generation | |
| Host port allocation per Twin, bound to loopback | |
| MQTT bridge credentials and topic prefixes | |
| `configuration.yaml` and `station.conf` rendering | |
| Container lifecycle, systemd units, restart on replug | |

Everything in the left column is a step a person would otherwise perform in a terminal.

---

## 6. Navigation

ui-kit `Sidebar`, custom `linkComponent` over `HashRouter`. Footer: `UserMenu` (account, organization
switcher, sign out). Bottom slot: theme switch, language.

| Item | Badge | Opens |
|---|---|---|
| **Dashboard** | — | Overview of everything |
| **Cameras** | count · ⚠ if a Twin is down | Camera list or empty state |
| **LoRaWAN Gateway** | ● connected / ○ not set up / ◌ no radio | Gateway status or setup |
| **Zigbee** | device count | Device list or empty state |
| **Thread** | ● / ○ / ◌ | Border router status |
| **Settings** | ⚠ if Docker missing or update waiting | Account, host, Docker, updates, logs |

---

## 7. Screens

### 7.1 Dashboard

**Needs attention strip** — appears only when something is wrong. One row per problem, each with a fix
button: "Camera *Front door* is offline `[Check camera]`", "Docker isn't running `[Start Docker]`".

| Card | Shows | Action |
|---|---|---|
| This device | Hostname, OS, arch, CPU + RAM gauges, disk free, Docker version | `[Settings]` |
| Cameras | N running / N offline, capacity bar with headroom | `[Scan for cameras]` |
| LoRaWAN | EUI, ● LNS state, uplinks today, last packet | `[Set up]` / `[View]` |
| Zigbee | Coordinator model, N devices, N offline, join state | `[Add device]` |
| Thread | ● state, N nodes | `[Set up]` / `[View]` |
| Chirp cloud | Organization, ● connection, last sync | `[Open Chirp]` |

**Recent activity:** last 20 events in plain language — "Living room lamp turned on", "Front door camera
recorded 12s of motion", "Gateway received 43 uplinks".

**Empty (nothing configured):** three large action cards — *Add a camera*, *Connect a Zigbee dongle*,
*Set up LoRaWAN* (dimmed on a desktop, with the reason).

### 7.2 Cameras

> **Revised 2026-08-01 — the wizard is gone.** What was here (a five-step
> credentials → preview → settings flow that pre-seeded `config.json` and
> registered with Lens) was a second implementation of the Twin's own settings
> screens. An audit of `Lens/twin` found every one of those fields already owned
> there: `Settings/CameraTab` (ONVIF discovery, stream sources, camera
> credentials), `Settings/LensTab` (`lens_uri`, `bootstrap_token`, Lens Key ID,
> MQTT, STUN/TURN and the camera name), `Settings/RecordingTab` and `StorageTab`
> (mode, retention). `config/defaults.go` also boots a fresh Twin with recording
> **off** by design. The app now does only what the user cannot do themselves —
> install and run — and the Twin does what it owns.

**Empty:** "No cameras yet. Chirp Hub can find cameras on your network automatically."
**Docker missing:** its own state, naming Docker as the cause.

**Header actions:** `[Add camera]` primary, `[Scan for cameras]` secondary.

**`[Add camera]` needs no camera and is the main route.** A scan finds only
cameras that advertise themselves over ONVIF — off by default on many models,
and unreachable entirely on another network — so someone with twenty cameras may
see one. Making setup depend on being found would leave the other nineteen with
no way in at all.

| Step | Shows | What happens |
|---|---|---|
| 1 Add | `[Add camera]` | A Twin starts with nothing attached and opens |
| 2 Configure | The Twin's own UI, in the system browser | Everything about the camera: address, credentials, stream, recording, retention, Chirp connection |

**Scanning is the shortcut, not the path.** It answers "what address is my
camera on" and pre-labels the row; clicking a found camera does exactly what
`[Add camera]` does, plus records the address so a later scan can mark it as
already set up. It is never blocked — knowing which cameras are reachable is
useful on its own.

**The scan states its own scope, and this is not decoration:**

> Searched 254 addresses on 192.168.2.0/24.
> Only cameras that advertise themselves can be found this way, and many
> don't — it's usually switched off in the camera's own settings. Cameras on a
> different network won't appear either. Use Add camera for any camera that
> isn't listed.

"Found 1" reads as a broken app to someone who owns twenty. The concrete number
is checkable and makes a camera on another VLAN obvious immediately. Note the
absence of "ONVIF" and "subnet" — "advertise themselves" is what those mean to
the reader, and the terms belong behind `[Technical details]` (Contract 2 rule 1).

A network too large to sweep is reported as a **successful** scan that searched
nothing, never as an error: telling someone with a flat /16 that they have no
network is the failure this whole section exists to prevent. Container and VM
bridges (`docker*`, `br-*`, `veth*`, `virbr*`, …) are excluded by registry —
running the scan here surfaced seven such networks, six of them /16s, which would
have buried the one line that mattered.

**First-login credentials.** The Twin fails closed on first boot — it wants
`TWIN_USERNAME`/`TWIN_PASSWORD`, or `TWIN_ALLOW_DEFAULT_LOCAL_CREDENTIALS=true`,
which fills in `root`/`root` and is documented there as a **dev override**.
Shipping a known login in an image strangers flash is exactly what that warns
against, so the app generates a password per Twin and shows it once, with the
username. The Twin marks the account must-change, so it stops working the moment
the user sets their own — which is the first thing it asks them to do.

The pair is kept on the camera record, **encrypted with `safeStorage`** like the
Chirp session token: the Twin consumes it on first boot, so a screen that forgets
it locks the user out of their own camera (Contract 2 rule 6).

**Setup availability is stated up front**, not discovered partway through. The
Twin image is unpublished, and `camera-availability` says so on the page before
the user picks a camera.

**How the Twin is actually created** — `camera-add`, in full:

1. ensures the Twin image — **a Twin already on the machine wins**, before the
   update feed is consulted at all, so a hub that has the image never needs the
   network and a locally built `lens/twin:local` is used directly. Otherwise:
   download → SHA-256 verify → `docker load`, first camera only. Twin is closed
   source and ships as a compiled image, never as source pulled into this app
2. allocates a free host port, **before** the container exists, so a Twin that cannot
   be given one fails with an explanation rather than half-existing
3. generates the first-login password
4. `docker run` with a **named volume** at `/home/twin/data`,
   `TWIN_USERNAME`/`TWIN_PASSWORD`/`TWIN_PUBLIC_URL` set, and **no configuration
   written**. A bind-mounted host directory was tried and fails: it carries the
   desktop user's ownership while the Twin runs as its own account, so the
   container sits in a retry loop on `mkdir ./data/config: permission denied` and
   serves nothing. A named volume is seeded from the image, ownership included —
   and it is the only form that works on Windows and macOS, where Docker runs in
   a VM and host uids do not map through
5. saves the record — only after the container exists

Bound to **`127.0.0.1:${hostPort}:80`**, not `0.0.0.0`. Publishing on all
interfaces put a camera's live view and settings on the LAN for anyone who
guessed the port, during exactly the window before the user has set a password.
Twins stay on bridge networking with a mapped port — 20 Twins on host networking
would all collide on port 80.

Discovery runs **in the main process** (`adapters/camera/onvif-discovery.ts`).
It used to run inside a short-lived host-network Twin calling
`POST /api/camera/onvif/discovery`, which cannot work before the first Twin
exists — and choosing the camera to create one *for* is the step that comes
first. The Twin keeps its own discovery for use inside its settings screen.

Both a multicast probe and a unicast sweep of the local subnet are sent:
multicast is the textbook method and returned **zero responders** on the network
this was built on, while a unicast probe to the same camera answers instantly.
The reply window starts when the **last** probe has left the socket — timing it
from the first is a race that silently truncated the sweep and missed the only
camera on the network.

A camera with ONVIF switched off — verified: the HiLook at `192.168.2.202`, 404
on every ONVIF path — can never be discovered by any method. That is not a gap
any more: `[Add camera]` sets it up without a scan, and its address goes into the
Twin along with everything else.

### 7.3 LoRaWAN Gateway

**No radio:** "No LoRaWAN radio on this computer. LoRaWAN needs a concentrator such as a RAK5146 on a
Raspberry Pi HAT. Chirp Hub sets it up automatically when installed on a Pi with one fitted."
`[Supported hardware]` `[What is LoRaWAN?]`

**Detected, not registered.** Read-only: `Gateway EUI` `0016C001FF1E96BB` `[Copy]` · `Radio` RAK5146
(SX1303) · `Connection` SPI · `Status` ○ Detected, not connected.

Fields: `Gateway name` (default `Chirp Hub — <hostname>`) · `Region` (select, defaulted from locale —
**the only place a region is chosen**, the device being region-agnostic by design) · `Location`
(optional, `[Use current location]`) · **Advanced:** `Network server URL` (derived, editable).

Buttons: **`[Register with Chirp]`** · `[I already registered this gateway]` · `[Advanced setup]`.

Progress — five plain sentences, not a log: *Creating your gateway in Chirp…* → *Downloading security
certificates…* → *Installing certificates…* (the password prompt is explained **before** it appears) →
*Starting the gateway…* → *Connecting to the network server…*

**The API, verified in `bff/pkg/api/`:**

| Step | Call |
|---|---|
| Register | `POST /nodes/nonminer/{band}/{gatewayId}` body `{"name": "..."}` — `gateways.go:72` |
| Certificates | `GET /nodes/signed-cert/{gateway_id}` — `certissuer.go:17`. Returns a **ZIP already containing `tc.trust`, `tc.crt`, `tc.key`** — exactly the three files Basic Station needs |
| LNS URI | derived: `wss://lora-{band}.cloud.chirpwireless.io:443` — `docs/configuration.md:77-78`. **Not returned by the API** |

**CRLF is normalised on the way in.** Basic Station rejects it silently enough to waste an afternoon —
that is why `scripts/fix_certs.sh` exists at all.

**Already-registered path:** EUI (prefilled) · `Network server URL` · four `Dropzone` targets, each with
✓/✗ **PEM validation before anything is written** — a bad certificate must be caught here, not three
screens later in a Basic Station log.

**Connected:** ● Connected · network server · region · uptime · **uplinks today** (live counter — the
proof) · last packet · signal chart. `[View logs]` `[Restart gateway]` `[Reconfigure]` `[Open in Chirp]`.

### 7.4 Zigbee

**No coordinator:** "No Zigbee coordinator found. Plug in a supported USB dongle and it will appear here."
Supported table (SONOFF Dongle Plus MG24, ZBDongle-E/P, SLZB-06/07, SkyConnect, ConBee) · `[Scan again]`
`[Where do I buy one?]`

**Found, not started:** `Coordinator` · `Connection` /dev/zigbee · `Type` EFR32 (auto-detected).
**Advanced:** `Zigbee channel` (default 15 — "15, 20 and 25 avoid most Wi-Fi") · `Network name`.
`[Start Zigbee]`.

**Add device:** a modal with a **60-second countdown ring** and device-specific *physical* instructions —
*"For a bulb: turn it off and on 5 times in a row until it flashes."* The app subscribes to
`zigbee2mqtt/bridge/event`; devices appear live. Per device: `Name` (prefilled) · `[Identify]` (blinks the
actual bulb) · `[Add to Chirp]`. `[Stop searching]` ends it early, and it closes itself at zero — a
permanently open Zigbee network is a security hole.

> **Never rename the Z2M `friendly_name`.** The topic is `zigbee2mqtt/<friendly_name>`, defaulting to the
> IEEE address. Renaming changes the MQTT topic and silently breaks every device already provisioned in
> Chirp. friendly_name stays the IEEE address forever; the human-readable name lives in this app and in
> Chirp. **This is the single most important thing to get right in the Zigbee flow.**

**Linking to Chirp**, verified against the `connection_create` and `device_provision_mqtt` contracts:

*Once per hub* — `connection_create(connector_type: "mqtt_cloud", name: "Chirp Hub — <hostname>")`.
`mqtt_cloud` because Chirp is the broker and the hub connects **outbound**; `mqtt_external` would need
Chirp to dial into a home NAT. Returns `broker_url`, `generated_username`, `generated_password`
(**shown once**) and `topic_prefix`, which go straight into the Mosquitto bridge stanza and are never
displayed. The remote prefix **must differ** from the local one or messages loop forever:

```
topic # out 1 zigbee2mqtt/  chirp/<gateway-eui>/zigbee/
```

*Per device* — `device_provision_mqtt`:

| Field | Value for a bulb |
|---|---|
| `name` | `Living room lamp` |
| `connection_id` | from the connection above |
| `client_device_id` | `0x00124b0022a1b2c3` — the IEEE address, stable forever |
| `device_id_topic` | `chirp/<eui>/zigbee/{{deviceId}}` — `{{deviceId}}` marks the id position |
| `telemetry_topics` | `[{"topic_template":"chirp/<eui>/zigbee/{{deviceId}}","connector_key":"state"}]` |
| `sensor_mappings` | `[{sensor_id, source_path}]` — `state`, `brightness`, `linkquality` |

Sensor mappings are proposed **from the payload actually observed** — subscribe, take the first message,
offer each JSON key with a unit guess, let the user confirm. That works for devices nobody has ever
modelled, which a static device database cannot.

**Who manages what.** Both, split by responsibility, and the split is forced by what each side can see:

| | Chirp Hub (local) | Chirp cloud |
|---|---|---|
| Pair / unpair, identify, remove | ✔ | ✘ (no radio access) |
| Link quality, battery, last-seen | ✔ | partial |
| Rename display name | ✔ (syncs) | ✔ |
| Dashboards, history, alarms, rules | ✘ | ✔ |
| Sensor mappings | proposes | owns |

**Troubleshooting is why the local device list cannot be skipped.** Four failure points, only
distinguishable locally:

| Symptom | Broke at | The app shows |
|---|---|---|
| Not in Z2M | radio / pairing | "Not joined — try pairing again" `[Add device]` |
| In Z2M, no messages | asleep or out of range | last seen + signal, "Move it closer to the hub or a mains-powered device" |
| Local messages, nothing in Chirp | bridge / credentials | bridge status ● + `[Test connection]` |
| In Chirp, no readings | mapping wrong | the raw payload beside the mapping, `[Fix mapping]` |

Each device row therefore carries **two status dots**, labelled "Connected to hub" and "Connected to
Chirp" — never "Zigbee" and "MQTT". That one design choice answers *"is it my device or your cloud?"*
without a support ticket.

**Device detail:** the two dots with plain explanations · a **live raw payload viewer** (JSON as it
arrives — the most useful debugging tool there is) · signal history · battery. `[Identify]` `[Rename]`
`[Remove from network]` `[Open in Chirp]`. Page level: `[View logs]` `[Restart Zigbee]` `[Network map]`
(Z2M exposes the graph via `bridge/networkmap`).

### 7.5 Thread

Same shape as Zigbee. Empty state: "Thread needs its own radio. One dongle cannot run Zigbee and Thread
at the same time — they use different firmware." `[Supported hardware]`.

### 7.6 Settings

| Section | Contents |
|---|---|
| Account | Chirp email, organization (switcher), `[Sign out]` |
| This device | Hostname (editable), OS, arch, CPU/RAM/disk, `[Restart device]` (Pi only) |
| Docker | Status ●, version, `[Install]` / `[Restart]`, licence note |
| Updates | App version, Twin version, `[Check for updates]`, auto-update toggle |
| Hardware | Detected radios table, `[Rescan hardware]` |
| Advanced | Log level, `[Open logs folder]`, `[Export diagnostics]`, `[Reset app]` |

`[Export diagnostics]` matters more than it looks: it turns "it doesn't work" into an actionable support
ticket without the user touching a terminal. Logs, container status, hardware inventory and versions, with
**credentials redacted** on the way out.

### 7.7 First run

1. **Welcome** — one sentence on what this does.
2. **Sign in to Chirp** — Zitadel OAuth in the **system browser** via `shell.openExternal` + a loopback
   redirect. **Never an embedded webview**: providers block them and they cannot be trusted. Fallback:
   paste an API token. Then an organization picker if the account has several.
3. **Docker check** — ✓ with version, or ✗ with `[Install Docker Desktop]`, progress, daemon wait and
   auto-continue. Licence note inline, not buried.
4. **Hardware scan** — a checklist that fills in live: LoRaWAN concentrator (EUI), Zigbee coordinator
   (model + type), Thread radio, cameras found on the network.
5. **Summary** — "Here's what we found", one primary action per item.

---

## 8. Twin distribution

`lens-twin` is closed-source and, as of 2026-08-01, **has no CI at all** — no `.github/` directory, and
every manifest reads `image: lens/twin:local # … when CI publishes`. `lens-core` and `lens-bridge` both
publish to ghcr.io; Twin does not.

The plan is a **public download link, not a private registry**, so nobody is pushed toward a private repo:

- multi-arch `buildx` → `linux/arm64` + `linux/amd64`, following the `build-go.yml` reusable workflow the
  other two services already use
- publish `docker save`d, zstd-compressed **per-architecture tarballs** as GitHub Release assets on the
  public `raspberry-pi-iot-hub` repo — the same place the SD image link lives
- source stays closed; only the built binary ships

```json
{ "latest": "2.1.0",
  "releases": [{ "version": "2.1.0", "published": "2026-08-01",
    "artifacts": [{ "arch": "arm64", "url": "https://…/lens-twin-2.1.0-arm64.tar.zst",
                    "sha256": "…", "size": 148000000 }] }] }
```

The app downloads → **verifies SHA-256** → `docker load`. Verification is not optional: this is an
executable fetched over the network onto a user's machine.

---

## 9. Camera capacity

Nobody has measured a Twin's real footprint. The only published figures are the K8s manifests
(`requests 100m/128Mi`, `limits 1000m/512Mi`), and those predate the cgo ffmpeg motion-detection path —
each Twin does **real libavcodec decoding** for motion detection and can spawn a separate go2rtc
subprocess. The 100m request is almost certainly not what a working camera costs.

So it gets measured: Pi 4 (8 GB) against a real camera on the LAN, `docker stats` plus frame-drop counts
at 1, 2, 4, 6 and 8 Twins, in continuous / motion / motion+HD. The result is a camera-count table by
hardware, published in the docs and feeding the dashboard's headroom bar. Desktop installs get no
artificial cap — a live gauge and a warning before oversubscription, with `[Add anyway]`.

---

## 10. Known blockers

| Blocker | Owner | Next action |
|---|---|---|
| `lens-twin` has no CI | Lens team | Add the multi-arch build; publishing needs repo permissions. Critical path for cameras |
| Code-signing certificates | Tim | Unsigned apps trip SmartScreen and Gatekeeper, which non-technical users read as "this is a virus". Needs an Apple Developer ID and a Windows OV/EV certificate. Blocks distribution, not development |
| Accepted `band` values for `POST /nodes/nonminer/{band}/{gatewayId}` | backend team | Not enumerated in the BFF. `device_provision_lorawan` lists EU868, US915, AU915, AS923, AS923-2, EU433, IN865, KR920, RU864, CN470, CN779, ISM2400. One confirmation before the region picker ships — a wrong value fails at gateway creation |
