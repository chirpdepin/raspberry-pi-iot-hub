# Implementation Status

Running record of the Ubuntu 26.04 build of the IoT Hub image. Update this file as work lands — it is
the answer to "where did we get to?" at the start of a new session.

> Context and the documentation map: **[CLAUDE.md](CLAUDE.md)**.
> File and path reference: **[REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md)**.
> Build guides: **[docs/ubuntu-2604.md](docs/ubuntu-2604.md)** (LoRaWAN),
> **[docs/zigbee-thread.md](docs/zigbee-thread.md)** (Zigbee/Thread).

**Last updated:** 2026-08-01
**Target device:** `hub@iot-hub.local` (192.168.2.199) — Raspberry Pi 4B 8GB, Ubuntu 26.04 LTS Server arm64
**Concentrator:** RAK5146 SPI (SX1303 / CORECELL) on a RAK2287/5146 Pi HAT
**Concentrator EUI:** `0016C001FF1E96BB` (read from the chip; `0016C0` is the RAK Wireless OUI)
**Goal:** see [CLAUDE.md](CLAUDE.md) — a redistributable, region-agnostic community image

> **The radio works.** SPI, reset line and RF path are all verified on hardware — see Phases 1–2.
> Remaining work is the forwarder and the repository, not the concentrator.

---

## Legend

| | |
|---|---|
| ✅ | done and verified on the device |
| 🔄 | in progress |
| ⬜ | not started |
| 🚧 | blocked — blocker named |

---

## Phase 0 — Baseline and system update

| | Item | Notes |
|---|---|---|
| ✅ | Pi reachable, inventory taken | Pi 4B 8GB, kernel `7.0.0-1009-raspi`, eth0 `d8:3a:dd:a3:4f:63` |
| ✅ | SPI confirmed enabled | `dtparam=spi=on`, `/dev/spidev0.0` + `0.1`, `spi@7e204000` = `okay`. No change needed — and `raspi-config` does not exist on Ubuntu |
| ✅ | GPIO controller identified | `gpiochip0` → `/soc/gpio@7e200000` (SoC pinctrl); `gpiochip1` is the firmware expander |
| ✅ | Permissions confirmed | `hub` ∈ `dialout`, which owns `/dev/spidev0.0` and `/dev/gpiochip0` → **no root needed at runtime** |
| ✅ | `apt update` + `full-upgrade` + prerequisites | 38 packages upgraded; `build-essential git gpiod libgpiod-dev` installed. `flash-kernel` warned "next reboot will boot twice" — expected, the reboot just takes longer |
| ✅ | Reboot into `7.0.0-1015-raspi` | Booted clean. IPv4 lagged behind the boot; the Pi was reachable over IPv6 link-local first — worth knowing before assuming a failed boot |
| ✅ | Re-verify SPI/GPIO survived the kernel bump | **The kernel added a third gpiochip.** `gpiochip2` is now a USB-attached controller. `gpiochip0` is still the SoC pinctrl (`pinctrl-bcm2711`, 58 lines) — but the count changing across one kernel update is exactly why the chip is resolved at runtime rather than hardcoded |
| ✅ | `/sys/class/gpio` still absent after the upgrade | Confirms the chardev approach was not a workaround for a transient state |

## Phase 1 — Concentrator reset

| | Item | Notes |
|---|---|---|
| ✅ | Root cause identified | **`/sys/class/gpio` does not exist on kernel 7.x.** Breaks this repo's `RESET_GPIO=529`, upstream Semtech `reset_lgw.sh`, and RAK's sysfs branch |
| ✅ | `scripts/concentrator-reset.c` written | GPIO chardev v2 ioctl, libc only, resolves the chip at runtime via `of_node`, pins from `/etc/iot-hub/concentrator.conf` |
| ✅ | Compile and install to `/usr/local/bin` | Clean under `-Wall -Wextra` with gcc 15.2 |
| ✅ | `/etc/iot-hub/concentrator.conf` deployed | Defaults: `RESET_PIN=17`, others unset (the RAK HAT wires only reset) |
| ✅ | `concentrator-reset info` / `start` verified | Resolves `/dev/gpiochip0` automatically, exits 0, idempotent across repeat runs, and **works unprivileged** (`hub` ∈ `dialout`) |

## Phase 2 — Prove the radio works

| | Item | Notes |
|---|---|---|
| ✅ | Build `sx1302_hal` | Cloned at `4b42025`, built into `/opt/iot-hub/src/sx1302_hal`. Verification tool only — **not** the runtime forwarder. Binaries are named `util_chip_id/chip_id` (not `util_chip_id`) and the tests live in `libloragw/` |
| ✅ | `reset_lgw.sh` shim | `chip_id` and the HAL shell out to `./reset_lgw.sh` in their working directory. Upstream's copy is sysfs-based, so a one-line shim redirects to `concentrator-reset` |
| ✅ | **Patch: temperature sensor made optional** | `scripts/sx1302_hal-optional-temp-sensor.patch`. See "Findings" below — without it the gateway will not start on this hardware at all |
| ✅ | `chip_id` prints a concentrator EUI | **`0016C001FF1E96BB`**, chip version 0x12 (v1.2). SPI bus, reset line and card all confirmed good |
| ✅ | `test_loragw_hal_rx` receives real uplinks | Live LoRaWAN traffic on 868.1 / 868.3 / 867.9 MHz, SNR 8.5–10.0 dB, valid CRC. Antenna and RF front end confirmed |

### Findings from Phase 2 — read before debugging this again

- **The RAK5146 has no STTS751 temperature sensor.** Semtech's HAL treats that as fatal in SPI mode
  (`ERROR: no temperature sensor found` → `failed to start the gateway`). Confirmed independently with
  `i2cdetect -y 1`, which returns a completely empty bus. This is upstream
  [sx1302_hal#58](https://github.com/Lora-net/sx1302_hal/issues/58) and it affects the RAK2287 too.
  The patch makes the sensor optional and falls back to 25 °C; the reading only feeds RSSI temperature
  compensation, so the cost is a small RSSI error, not a broken gateway.
- **Installing `i2c-tools` silently broke I2C access.** Its udev rule creates an `i2c` group and moves
  `/dev/i2c-1` from `dialout` to `i2c`, so a user who could open the bus before can no longer do so.
  That turns "sensor absent" into "permission denied" — the same visible failure, a different cause.
  `hub` has been added to `i2c`, and the installer must do the same. Worth remembering: the diagnosis
  changed purely because a diagnostic tool was installed.

## Phase 3 — Basic Station, region-agnostic and unprovisioned

| | Item | Notes |
|---|---|---|
| ✅ | Install `docker.io` + `docker-compose-v2` | 29.1.3 / 2.40.3, from the Ubuntu archive; no third-party repo |
| ✅ | Confirm the image's env-var contract | Read the entrypoint on the device rather than guessing. Findings below — they simplified the design considerably |
| ✅ | `/opt/iot-hub/lorawan/docker-compose.yml` | Drops `privileged`, passes `/dev/gpiochip0` and `/dev/i2c-1`, sets `RESET_GPIO=17`, `USE_LIBGPIOD=1`, `GATEWAY_EUI_SOURCE=chip`, `HAS_GPS=0` |
| ✅ | No `station.conf` installed | The image ships `station.corecell.conf` — radio hardware config only, **no channel plan**. Nothing region-specific for us to add |
| ✅ | `scripts/detect-concentrator.sh` | Reports `RAK5146 (CORECELL) on SPI /dev/spidev0.0, EUI 0016C001FF1E96BB` → `/etc/iot-hub/concentrator.env` |
| ✅ | `config/iot-hub-lorawan.service` | Installed and enabled. Verified: `systemctl start` with no credentials leaves it `inactive` and starts no container |
| ✅ | Full installer run from a clean state | `install-ubuntu.sh --skip-upgrade` on a wiped `/etc/iot-hub`, `/opt/iot-hub` and `/usr/local/bin` — patch, build, detect, docker, unit, all green |
| ✅ | Integration test of the local chain | With throwaway credentials pointed at an unreachable host: Basic Station 2.0.6 started, read EUI `0016C001FF1E96BB` from the chip, resolved `gpiochip0` / reset 17 / enable 0, launched the LGW slave and reached the LNS connection attempt |
| ✅ | Fresh-boot check | After `reboot`, all nine checks pass with **no manual steps**: kernel, devices, `concentrator-reset info`/`start`, `chip_id` EUI, `detect-concentrator.sh`, unit enabled-but-inactive, no stray containers, compose valid, `/sys/class/gpio` still absent |

### Findings from Phase 3 — these simplified the design

- **The Basic Station image already solves both problems on its own.** It ships libgpiod **1.6.3** and a
  `reset.sh.gpiod` template, auto-selects it when `gpioset` exists, and finds the chip with
  `gpiodetect | grep pinctrl`. Its bundled HAL is also already patched for boards with no temperature
  sensor — its `chip_id` read the EUI cleanly where the stock host build failed. So the container needs
  **neither** `concentrator-reset` bind-mounted **nor** our HAL patch. Both remain necessary for the
  host-side verification tools, which is what they were built for.
- **`RESET_GPIO=17` is the image's own default** (`RESET_PIN` 11 → BCM 17 via its pin map). The old
  `RESET_GPIO=529` in this repo was actively overriding a correct default with a sysfs number.
- **Power-enable is genuinely unused** on this HAT — the image reports `Enable GPIO: 0`, matching the
  reset helper's defaults. Only the RAK833 gets a power-enable pin in the image's logic.
- **`/app/config` must be mounted read-write.** The image generates `reset.sh`, `reset_lgw.sh` and
  `station.conf` there on every start. A read-only mount fails in a way that does not point at the mount.
- **The credential check runs before concentrator detection**, so an unprovisioned container restart-loops
  with `ERROR: Missing configuration` and never touches the radio. That is exactly the failure the
  `ConditionPathExists` gate prevents — observed directly, not theorised.
- **`MODEL=AUTO` is supported** if a future image should probe rather than be told: the model table
  already covers RAK2287/RAK5146/RAK5166/RAK5167/RAK7371 and more.

### The STATIC/DYNAMIC mode defect — found before commit, not after

The first version of the compose file shipped **no `station.conf`**, on the reasoning that the image
supplies its own and nothing region-specific should be added. Testing the real provisioning flow proved
that wrong, and it would have shipped a gateway that could never connect to Chirp:

- The image selects its credential mode purely on whether `station.conf` exists. **Present → STATIC**,
  credentials read from `tc.uri`/`tc.trust`/`tc.crt`/`tc.key` **files**. **Absent → DYNAMIC**,
  credentials read from a `TC_KEY` **environment variable** holding a token.
- Chirp issues **certificates**, not a token, so this deployment must be STATIC. Without `station.conf`,
  dropping the four credential files in produces `ERROR: Missing configuration … define valid TC_KEY`
  forever — an error that names none of the files actually involved.

Fixed by adding `config/station.conf.template`, rendered by `detect-concentrator.sh`. Two further traps
surfaced while doing it, both fixed and documented in `config/README.md`:

- The image's own `station.corecell.conf` ships `"routerid": ""`, which Basic Station rejects as
  `Illegal EUI` and then **discards the entire file**. The template substitutes the chip EUI.
- A `"_comment"` key added to the template broke the image's `jq` parsing
  (`Cannot index array with string "device"`), after which it could not find the SPI device, fell back
  to auto-discovery, decided the interface was USB, and died on `/dev/ttyACM0 does not exist`. JSON has
  no comments here — the constraints live in `config/README.md` instead.
- `"gps": ""` in `station_conf` makes Basic Station open `./` as a TTY and log `GPS:CRIT` on every
  start. `HAS_GPS=0` does not suppress it; the key has to go.

Verified end to end in STATIC mode with throwaway credentials: `Mode: STATIC`, `Protocol: LNS`, EUI
`0016C001FF1E96BB`, SPI `/dev/spidev0.0`, `gpiochip0`, reset 17, LGW slave started, zero parse errors,
zero GPS errors — failing only at `tc key/cert rejected by MBedTLS`, which is exactly correct for
placeholder certificates and is the precise point where real Chirp credentials take over.

## Phase 4 — Repository

| | Item | Notes |
|---|---|---|
| ✅ | `CLAUDE.md` | Product intent, the two hard constraints, the GPIO trap, hardware facts, stale spots |
| ✅ | `IMPLEMENTATION_STATUS.md` | This file |
| ✅ | `scripts/install-ubuntu.sh` | Idempotent; verified by a full run from a wiped state |
| ✅ | `scripts/reset_lgw.sh`, `scripts/sx1302_hal-optional-temp-sensor.patch` | Shim + patch, both exercised by the installer |
| ✅ | `docs/ubuntu-2604.md` | The sysfs removal, why not `gpioset`, why no region, verification order, GNSS opt-in |
| ✅ | Update `docker/docker-compose.yml` | Region-free, no `privileged`, chardev devices, EUI from chip |
| ✅ | Fix `README.md` | Added the Ubuntu pointer and the two platform traps up front; corrected the EUI section. The `RESET_GPIO` contradiction is resolved — the prose was right (GPIO 17) and the compose file was wrong (529) |
| ✅ | Refresh `REPOSITORY_STRUCTURE.md` | Added `chirp_bridge/`, `fw/`, and all new files; removed the `config/tc.*` entries that never existed; added a repo→device path map |
| ✅ | Fix `webconfig/main.go` bugs | Removed `updateDockerCompose` entirely (it read the compose file from the wrong directory *and* rewrote a `SERVER:` key that does not exist — writing `tc.uri` is what actually configures the LNS). Also deleted three functions that were defined but never called, and the now-unused `time` import. `go vet` and `go build` clean |
| ✅ | `config/station.conf.template` + `config/README.md` | Region-free radio config with a routerid placeholder, and the constraints that cannot live inside JSON |
| ✅ | Commit on a branch | `ubuntu-rak5146-concentrator-support`, branched off `main`. **Not pushed** |

---

---

# Zigbee / Thread radios

**Verified on hardware 2026-07-31** with a SONOFF Dongle Plus MG24 (`10c4:ea60`, serial
`f620d69ac39aef11aa72ad9061ce3355`).

| | Item | Notes |
|---|---|---|
| ✅ | Driver audit | `cp210x`, `ch341`, `ftdi_sio`, `cdc_acm`, `pl2303` **all already in the kernel** — nothing to install. The drivers were never the problem |
| ✅ | `config/udev/99-iot-hub-radios.rules` | ModemManager exclusion, `dialout` access, role symlinks. Two-layer: MM exclusion matches broadly by bridge vendor, role assignment never matches on bridge chip alone |
| ✅ | `scripts/iot-hub-radio-role` | udev `PROGRAM` helper; explicit map wins, brand descriptors auto-claim, generic ones are left alone |
| ✅ | `scripts/detect-radios.sh` | Auto-mapped the MG24 → `zigbee`, derived `ZIGBEE_ADAPTER=ember` from the descriptor |
| ✅ | Mosquitto 2.1.2 | Container healthy; `127.0.0.1:1883` |
| ✅ | Zigbee2MQTT 2.12.1 | **Talks to the radio**: EmberZNet `7.4.5 [GA]`, EZSP v13, IEEE `0xd4fe28fffe299980`, channel 15, `bridge/state` = `online` |
| ✅ | OTBR (digest-pinned) | Installed; unit correctly inactive with no second dongle |
| ✅ | `install-radios.sh` | Full run from clean; wired into `install-ubuntu.sh` |
| ✅ | Replug survival | USB unbind/bind: `/dev/zigbee` returned with `IOT_HUB_RADIO_ROLE=zigbee` intact |
| ✅ | Broker isolation | Refused from another host on the LAN; `ss` confirms `127.0.0.1:1883` and `127.0.0.1:8080` |
| ✅ | ModemManager | **0** probes of the dongle since boot |
| ✅ | Fresh-boot check | All ten checks pass with no manual steps |
| ✅ | Commit | Same branch as the LoRaWAN work; not pushed |

### Findings

- **Nothing needed installing for the drivers.** What breaks coordinators is the environment: ModemManager
  probing the port, `brltty` claiming CP2102 devices, `ttyUSB*` enumeration order, and permissions.
- **Role assignment must not key on the bridge chip.** `10c4:ea60` is a generic CP2102 on countless
  unrelated boards. Brand descriptors auto-claim; generic ones are reported for manual mapping, because
  silently claiming the wrong device is worse than asking.
- **`openthread/otbr` publishes only `latest`** — pinned by digest
  `sha256:0cfccb10c3d5f878028e07ea4f652f72fc967592ee9591978c41dcced0ede4e6` (arm64, v2026.07 build).
- **Docker resolves device symlinks at container start**, so a replug needs a restart — handled by the
  udev-triggered `iot-hub-{zigbee,thread}-restart.service`, which only act if the service was running.
- **Z2M's `configuration.yaml` is state, not config.** It stores the network key and pairings; the
  installer deliberately does not render it.
- **MQTT topology settled**: local Mosquitto, bridged outbound to Chirp as `mqtt_cloud`. `mqtt_external`
  would need Chirp to dial into a hub behind home NAT. Z2M is itself an MQTT client and could talk to
  the cloud directly, but it accepts only one server — doing so would strand every other local consumer
  and take Zigbee down with the WAN. Mosquitto over EMQX on-device: ~10 MB vs ~200 MB idle.

### Left running on the test unit

The MG24 now holds a **formed Zigbee network** (channel 15, 0 devices joined) and
`/etc/iot-hub/zigbee/configuration.yaml` exists, so `iot-hub-zigbee` starts on boot. To return the unit
to pristine unprovisioned state: `sudo systemctl stop iot-hub-zigbee && sudo rm -rf /etc/iot-hub/zigbee/*`.

---

## Open blockers

| | Blocker | Owner / next action |
|---|---|---|
| 🚧 | **End-to-end uplink to Chirp is the only unverified hop.** Everything up to and including certificate loading is confirmed; with placeholder certs it fails precisely at `tc key/cert rejected by MBedTLS`, which is where real credentials take over. Needs the gateway registered in the Chirp LNS and the resulting `tc.uri` + `tc.trust` / `tc.crt` / `tc.key`, which live in the Chirp console and are not reachable from this machine | Tim: register EUI `0016C001FF1E96BB` and hand over the four files. Then: `sudo install -m 0640 tc.* /etc/iot-hub/lorawan/`, `systemctl start iot-hub-lorawan`, confirm uplinks. ~5 minutes, no redesign |

## Deliberately out of scope

- **Electron onboarding app** — the next piece of work. `webconfig/main.go` is its working predecessor.
- **GNSS** — off by default. Enabling it costs onboard Bluetooth (`dtoverlay=disable-bt` + freeing
  `ttyS0` from `serial-getty`). Documented as a one-line opt-in.
- **Zigbee2MQTT / OTBR / Matter / Lens twin** — already documented in the `README_*.md` files; untouched
  by this work.

---

# Chirp Hub desktop app (`app/`)

Design record: **[app/electron.md](app/electron.md)**. Built in 11 phases, each ending in a commit, each
carrying its own **SOLID · UX · Portability · Single-source-of-truth** gate — a constraint stated once at
the top of a long plan stops influencing the work several phases later.

**Goal:** a non-technical person sets up cameras, LoRaWAN and Zigbee from a Raspberry Pi with a screen,
using no terminal. Finish line is Phase 11: all three live and reaching Chirp at once.

| | Phase | State |
|---|---|---|
| ✅ | 1 · Docs and enforcement | `app/electron.md`, `CLAUDE.md` contracts, `check-boundaries.ts` + CI |
| ✅ | 2 · Scaffold, ui-kit, shell | Electron 43 + React 19 + MUI 9 + ui-kit; 22/22 smoke checks |
| ✅ | 3 · Domain, ports, capabilities, Docker | 9 use-case tests, no Docker/radio/Electron needed |
| ⬜ | 4 · Dashboard and empty states | |
| ⬜ | 5 · LoRaWAN gateway | |
| ⬜ | 6 · Zigbee | |
| ⬜ | 7 · Twin build pipeline | 🚧 needs Lens-team repo permissions |
| ⬜ | 8 · Cameras | |
| ⬜ | 9 · Pi desktop image | |
| ⬜ | 10 · Capacity benchmark and packaging | |
| ⬜ | 11 · End-to-end wiring, live three-way test | |

### Phase 1 — done 2026-08-01

- **`app/electron.md`** — architecture, all four contracts, the complete screen-by-screen spec with real
  API fields (`POST /nodes/nonminer/{band}/{gatewayId}`, `GET /nodes/signed-cert/{gateway_id}`,
  `connection_create`, `device_provision_mqtt`), Twin distribution, ui-kit gotchas, blockers.
- **`CLAUDE.md`** — four contract sections + `app/electron.md` in the documentation map.
- **`app/scripts/check-boundaries.ts`** — 7 enforced rules across all four contracts.
- **`.github/workflows/app-boundaries.yml`** — runs the self-test *first*, so a green "boundaries clean"
  cannot be produced by a broken checker.

**SOLID gate — passed, and demonstrated rather than assumed.** `--self-test` plants a violation of every
rule and asserts each is caught, then asserts a clean tree passes. All 7 fire correctly:
`domain-is-pure`, `usecase-depends-on-ports`, `usecase-has-test`, `renderer-has-no-node`,
`no-hardcoded-color`, `no-hardcoded-path`, `no-inline-image-tag`.

**UX gate — passed.** The six user-contract rules are recorded with a worked example each, so later
phases check against something concrete instead of a slogan.

**Portability gate — passed.** The four portability rules and the full Ubuntu-Core impact table are
recorded — including the correction that **Core is snap-based, not Docker-based**, and that what survives
a move is `domain/`, the use cases, the ports and the renderer, while `install-*.sh`, udev rules, systemd
units and `dtparam=spi=on` are replaced.

**Single-source-of-truth gate — passed.** Contract 4 added at your request, with a value→owner table
(theme, `locales/`, `config/defaults.ts`, `config/images.ts`, `PathsPort`, zod schemas, registries) and
three of its rules already machine-checked.

### Phase 2 — done 2026-08-01

Electron 43.2.0 / React 19.2.8 / MUI 9.2.0 / ui-kit 1.0.0 (pinned to commit `542ddde`, the tree
chirp-frontend consumes). Three-process split with `contextIsolation`, `nodeIntegration: false` and
`sandbox: true`. Six-item navigation, theme toggle, i18n, HashRouter.

**SOLID gate — passed.** The renderer holds no business logic; `preload` exposes a typed API rather than
raw `ipcRenderer`; no component imports from `main/`. Boundary checker green.

**UX gate — passed.** Labels are plain English ("Cameras", not "Twins"), and the smoke test asserts that
`container`, `Twin`, `Z2M`, `dockerode` and `ttyUSB` appear nowhere in the rendered UI.

**Portability gate — passed.** Verified at **both** 1024×600 and 1440×900, with no horizontal overflow at
either.

**Single-source-of-truth gate — passed.** Colours and spacing from the ui-kit theme, strings from
`locales/`, nav from a registry, IPC channel names from `shared/ipc.ts`, window sizes from
`config/defaults.ts`.

#### Five real defects found by building and running it, not by reading it

1. **TypeScript 7 was downgraded without evidence and then restored.** The plan allowed a fallback to
   5.x "if MUI v9 types misbehave"; I applied it pre-emptively. Tested properly: TS 7.0.2 typechecks MUI
   9, React 19, generics and the ui-kit subpaths with **zero errors**. TS 7 does remove `baseUrl`, so
   path mappings must be relative — that is the only change it required.
2. **`electron` was being bundled into the main process.** `externalizeDepsPlugin()` only externalizes
   `dependencies`, and electron is a devDependency, so the bundler inlined its npm helper and the app
   died with a misleading "Electron failed to install correctly". Fixed with an explicit `external`.
3. **The preload was built as ESM.** A sandboxed renderer can only load a **CommonJS** preload; an ESM one
   is ignored silently, so `window.chirpHub` never appeared. Now emitted as `.cjs`.
4. **The shell covered the whole screen on a Pi touchscreen.** The ui-kit treats **anything below 1248px
   as mobile** — its Sidebar becomes a full-screen overlay there. A hand-rolled flex row also failed to
   offset the fixed-position Drawer. Now uses the kit's `BaseLayout` with responsive open/closed state.
   **Every DOM assertion passed while this was broken; only the screenshot caught it** — which is why the
   smoke test now checks both viewports and captures PNGs.
5. **npm 11 blocks install scripts by default**, so Electron's binary was never downloaded. Approved
   explicitly, recorded in `allowScripts` in `package.json`.

Also: the ui-kit's peer set is internally inconsistent — it peers `@nivo/line@0.88`, which caps React
below 19, while itself requiring React 19. npm 7+ auto-installs peers and fails; `legacy-peer-deps=true`
in `app/.npmrc` restores the correct semantics for a library with a large optional peer surface. This is
why chirp-frontend gets away with the same set under Yarn 1.

### Phase 3 — done 2026-08-01

`domain/` (host, capabilities, typed errors, `Result`), two use cases with ports declared by the
consumer, four adapters, the IPC layer and the composition root.

**SOLID gate — passed, and demonstrated.** **9 use-case tests run with fake ports — no Docker, no radio,
no network, no Electron.** That is the proof the layering is real: `host-capabilities` and
`docker-ensure` each declare their ports in their own `contract.ts`, adapters implement them, and
`index.ts` is the only file naming a concrete type. Five narrow ports (`HostInfoPort`,
`ContainerRuntimePort`, `RadioDiscoveryPort`, `ContainerRuntimeControlPort`, `PathsPort`) rather than one
`SystemPort`.

**UX gate — passed.** Every unavailable capability carries a **reason**, asserted by a test that fails if
any capability is `false` with no explanation. "Docker missing" and "Docker stopped" are deliberately
different messages with different actions — a test asserts they never collapse into one, because sending
someone to reinstall software they already have is worse than saying nothing.

**Portability gate — passed.** `PathsPort` is the single owner of every filesystem path; the boundary
checker fails the build on `/etc/`, `/usr/local/` or `/var/lib/` appearing anywhere else. Linux and
desktop layouts are separate implementations, so Ubuntu Core's `$SNAP_DATA` is a third one — not a code
change.

**Single-source-of-truth gate — passed.** Reason strings are English text used directly as i18n keys.
Radio detection **reads what `detect-radios.sh` already wrote** rather than re-implementing dongle
detection in TypeScript, which would have created a second source of truth disagreeing with the udev
rules and systemd units.

Verified against real hardware, both directions:

| | This desktop (x64, no radios) | The Pi |
|---|---|---|
| cameras | ✅ available (Docker 29.1.3) | ✅ Docker 29.1.3 |
| lorawan | ✅ absent, with the RAK5146 explanation | ✅ `GATEWAY_EUI=0016C001FF1E96BB` |
| zigbee | ✅ absent, with the dongle explanation | ✅ `/dev/zigbee` present |
| thread | ✅ absent, with the second-radio explanation | ✅ correctly absent |

One design note worth keeping: the Docker adapter probes with `docker version --format
'{{.Server.Version}}'` rather than a socket connect, because only that distinguishes **missing binary**
(ENOENT) from **installed but daemon down** (non-zero exit). A socket probe reports both as "cannot
connect", which would collapse the two screens the UX gate requires to stay separate.

### Chirp frontend conventions applied — 2026-08-01

`chirp-frontend/CLAUDE.md` was read after Phase 2 and its rules applied retroactively to Phases 1 and 2,
as **Contract 5**. Real changes, not cosmetic:

| Was | Now |
|---|---|
| Dotted i18n keys (`pages.zigbee.title`), English only | **Key = the English text**, all five languages (`en`, `de`, `es`, `fr`, `pt`) in `locales/resources/*.json`, keyed by language first |
| 4-space, double-quoted JSX | Prettier config **copied verbatim** from chirp-frontend — single quotes incl. JSX, 2-space, `printWidth` 120 |
| Ad-hoc page markup | `PageWrapper` + `StackRowJB` header + `Typography variant='h2'` |
| Plain component | `memo<Props>` with named export |
| — | ui-kit import boundary: the 12 wrapped MUI primitives must come from `/primitives` |

**Phase 1's checker was extended, not just the code.** It now enforces 13 rules — added
`no-ui-kit-root-import`, `no-mui-primitive`, `no-default-export`, `no-any`, `i18n-complete` and
`import-order`. The self-test plants a violation of each and asserts it is caught; all 13 fire.
`i18n-complete` is the one ESLint could never do: it checks **across** files that every language has an
identical key set, so a key added to `en` alone fails the build rather than surfacing as English text
inside otherwise-translated copy.

**ESLint is parked, with a reason.** `typescript-eslint`'s peer range is `>=4.8.4 <6.1.0` — it supports
neither TypeScript 7 (current stable, which we verified and use) nor TypeScript 6 (still beta). It cannot
parse these files at all. The config is kept as `eslint.config.js.pending` and is one `npm install` away
once support lands; meanwhile the substantive rules live in the boundary checker, which needs no TS
parser because it is line-based.

**Two documented deviations from chirp-frontend:** npm with `legacy-peer-deps` rather than Yarn 1
(Electron tooling is npm-first), and **MUI v9 rather than v7** — v9 removed system props from `Stack`, so
the documented `<Stack gap='24px' width='100%'>` does not compile and those values go through `sx`.

## Licensing — resolved 2026-08-01

**MIT**, `Copyright (c) 2025-2026 Chirp` — holder and start year taken from the existing notice in
`webconfig/README.md` rather than invented. Previously the repo had **no `LICENSE` file at all** while
`README.md` contradicted itself (MIT in one half, BSD 3-Clause in the other), which for a project meant
to be downloaded and modified meant nobody had permission to use it.

| | Item |
|---|---|
| ✅ | `LICENSE` added (MIT) |
| ✅ | Both `README.md` license statements corrected to MIT and pointed at `LICENSE` |
| ✅ | `docs/CONTRIBUTING.md` written — the link in `README.md` had been dead since the repo was created |
| ✅ | Both linked from the `CLAUDE.md` documentation map |

## Before any image ships

- 🚧 **A GitHub personal access token is stored in plaintext in `.git/config`** — the `origin` remote is
  an `https://ghp_…@github.com/...` URL. Anyone who obtains this checkout gets push access to the
  repository, and an SD-card image containing it would publish the token. **Owner: Tim.** Next action:
  revoke it (GitHub → Settings → Developer settings → Personal access tokens), then
  `git remote set-url origin git@github.com:chirpdepin/raspberry-pi-iot-hub.git` or use a credential
  helper. Note `.git/` is not tracked, so this cannot be fixed by a commit.
- `/boot/firmware/network-config` holds the home Wi-Fi PSK **in plaintext**.
- SSH is **key-only** with keys no adopter holds — a flashed image would lock them out.
- `README.md` still advertises the old image's `iotmaster` / `123qweASD` credentials.

## Phase 11 — end-to-end wiring and the live run (2026-08-01)

Ran against a real Chirp account and the real hardware, which is where the
remaining assumptions got tested.

### Cross-cutting risks, verified on the device

| Risk | Result |
|---|---|
| Port collisions | No collision. Mosquitto 1883 and Zigbee2MQTT 8080, both loopback-only. **All four containers use host networking**, so they publish no Docker port mappings — which is exactly why the allocator needs a reserved-port table rather than Docker's list |
| One broker, three producers | One Mosquitto, `$SYS` and `zigbee2mqtt/bridge/state` both live, no topic overlap |
| Shared config tree | Each subsystem owns its own directory under `/etc/iot-hub/`; no overlap |
| Reboot survival | All four units `enabled`; both containers `restart=unless-stopped` |
| Resource contention | Basic Station, Mosquitto and Zigbee2MQTT ran together throughout |
| Partial failure | Each subsystem probed independently; `allSettled` means one broken probe cannot blank the others |

### Defects found and fixed in this repo

- **Port allocation was camera-local.** It only asked the kernel whether a bind
  would succeed, so a *stopped* container's port read as free — hand it to a
  second Twin and both break when the first restarts. Now one use case with a
  reserved-port table, consulting Docker's mappings including stopped
  containers, returning a `Result` instead of a plausible-but-unbindable port.
- **Health was read from systemd alone.** The units are `Type=oneshot` +
  `RemainAfterExit=yes` around `docker compose up -d`, so systemd keeps
  reporting `active` after the container dies. Confirmed on the Pi. Probes now
  combine unit state and container state.
- **Cameras were unreachable.** Phase 8's use cases had no IPC channels and no
  page, and `camera-add` returned a record nothing stored — the list could never
  have survived a restart.
- **`isServiceActive` was stubbed to `false`**, so Zigbee showed as stopped
  while running.
- Duplicated systemd unit names and MQTT topic constants centralised.

### Corrections from the live platform

Recorded in `docs/platform-findings.md`, with the three platform-side defects.

| Was | Is |
|---|---|
| 12 gateway bands inferred from `device_provision_lorawan` | **10**, from the console's own picker. `AU915-0`/`US915-0`/`US915-1` carry a sub-plan suffix; CN470, CN779, ISM2400 are device-only. **This closes the open question from the plan** |
| LNS host = `lora-{band}` | Right, but the sub-plan suffix is dropped: `US915-0` → `lora-us915` |
| Remote MQTT prefix = `chirp/<eui>/` | **Assigned by Chirp** as `iot/<org>/<connection>`. A locally invented prefix publishes where Chirp does not read — telemetry leaves the hub and silently goes nowhere |

### Live run — what got through

| Step | Result |
|---|---|
| Register gateway in Chirp | ✅ EUI `0016C001FF1E96BB`, EU868, certificates issued |
| Install credentials, start Basic Station | ✅ Reaches the LNS, INFOS handshake completes, MUXS URI returned |
| Gateway stays connected | ❌ **Blocked by Chirp** — `tc.trust` has no root CA, and the LNS ingress 502s on some connections |
| Create Cloud MQTT connector | ✅ Credentials valid; broker accepts the session and a publish |
| Zigbee telemetry to Chirp | ❌ **Blocked by Chirp** — the broker's TLS certificate expired 2026-07-23 |
| Bridge configured on the hub | ✅ Correct and outbound-only; connects as soon as the certificate is renewed |
| Pair the Zigbee bulb | ✅ Paulmann 50064 spot `0x00158d00053c075f` joined, LQI 184–188. Toggled off/dim/off/bright from the hub and **confirmed physically by the owner** |
| Provision it in Chirp | ✅ Device created on the Cloud MQTT connector, topic `<prefix>/zigbee2mqtt/{deviceId}`, `state` mapped |
| Prove the MQTT path | ✅ Publishing the real payload past the expired certificate made Chirp resolve the device, parse the JSON and offer exactly `state`/`brightness`/`linkquality`. **Only the certificate is in the way** |
| Camera Twins | ⏸ Deferred — no published Twin image, and testing needs a Lens login |

### GUI parity — what the live run did NOT prove

The live run was done through the Chirp **web console** and the command line. That
verified the *values* the app uses, but most of those steps **have no GUI path in
the app yet**, so they are specified rather than proven.

**Verified to match reality** — these are now correct in code because the live run
corrected them:

| | Checked against |
|---|---|
| `LORAWAN_REGIONS` | the console's own region picker |
| `lnsUrlForRegion` | the URL the console displayed after registering |
| `CERT_ZIP_ENTRIES`, `isPemOfType` | the real certificate ZIP (`tc.key` is PKCS#1) |
| MQTT remote prefix source | the connector's `topic_prefix` |
| `bridgeTopicLines` output | the stanza actually installed on the Pi |

**No GUI path exists yet** — a user cannot do these in the app today:

| Step | State |
|---|---|
| Sign in to Chirp | **Missing entirely.** No OAuth flow; `shell.openExternal` is used only by the Docker installer. Everything Chirp-side is therefore unreachable from the app |
| Create the Cloud MQTT connector | No code path. `ensureConnection` is an honest error stub |
| Provision a Zigbee device into Chirp | `provisionDevice` is an honest error stub |
| Write the Mosquitto bridge stanza | `bridgeTopicLines` is implemented and tested, but **nothing calls it** — no adapter writes the config |
| Register a camera with Lens | Stub, blocked on the Lens API |

**Implemented but never exercised against the live API:**

- `gateway-register` → `POST /nodes/nonminer/{band}/{gatewayId}` and the
  certificate download. Unit-tested against a fixture ZIP; the real endpoint was
  driven through the console instead.
- `gateway-provision` → writes `tc.*` and starts the unit. The file handling is
  real, but it would install the same incomplete `tc.trust` Chirp ships, so it
  would hit finding 1 exactly as the manual run did.

**A design consequence found today:** `zigbee-device-link-chirp` proposes sensor
mappings from the observed payload, but Chirp **silently discards a mapping that
has no normalized key**, and the normalized-key picker is empty until a metric
exists. So the use case must **create the metric first, then map** — otherwise it
will report success and store nothing, which is precisely what happened by hand.

## Chirp UI parity and camera discovery (2026-08-01)

Running the app showed it did not look like Chirp, and that camera discovery
could not work at all. Six defects, all reproduced before being fixed.

| Defect | Fix |
|---|---|
| No logo, no nav icons | Chirp wordmark and bird mark copied as inline SVG using `currentColor`; icons carried in the `NAV_ITEMS` registry |
| Collapse hid the sidebar and never came back, showing clipped labels (`Dashb`, `Camer`) | Open/closed and collapsed are now separate states — the control was wired to `closeSidebar`, and `isCollapsed` was hardcoded `false` |
| No language selector, and `lng` hardcoded to `en` | Registry of Chirp's five languages, plus persistence through the same `localStorage` helper the theme uses. **Verified by restarting the app**, since a selector alone would have reset silently |
| Every screen inset **72px** vs Chirp's 24px | `<main>` carried `theme.spacing(6)` (48px, kit base 8) on top of `PageWrapper`'s 24px. A smoke check now asserts `main` adds no padding |
| Page actions left-aligned in the body | One `PageLayout` with the action **top-right**, following Chirp's rule that it appears only once the page has content |
| Empty states used an `h6` with no icon | Now through `EmptyBlock`'s own `title`/`icon` props — 12px uppercase above the 56×56 mark, as Chirp renders it |

### Camera discovery — the silent failure

`camera-discover` returned a bare array, so a scan that **could not run** was
indistinguishable from one that **found nothing**. The Twin image is unpublished,
`docker run` failed, the adapter swallowed it, and the user was told "no cameras
found" — pointing them at cameras that were fine.

It now returns a `Result`, and a smoke check drives the real IPC channel to
assert a scan that cannot run says so. It also calls Twin's HTTP API
(`POST /api/camera/onvif/discovery`) rather than the CLI: only the adapter
changed, no use case or test did, which is what `CameraDiscoveryPort` was for.

**Manual entry is now a first-class route**, because probing the network proved
discovery cannot find everything:

| Host | Result |
|---|---|
| `192.168.2.205` | ONVIF (`TC71`), but answered **unicast only**, on non-standard port **2020** |
| `192.168.2.202` | HiLook — **ONVIF disabled entirely**. Can never be discovered; address entry is the only route |

`[Open camera]` is also wired now — it was specified from the start but never
implemented, so `hostPort` was stored and never used. Opens the Twin's own UI on
loopback in the system browser.

### Known gaps

- 🚧 **Empty states that offer only `secondaryLabel` render no action at all.**
  `EmptyState` requires both `secondaryLabel` and `onSecondary`, and the LoRaWAN
  and Zigbee "no hardware" states pass only the label — so "Supported hardware"
  never appears, and those screens state the problem without a next step, against
  Contract 2 rule 4. Not fixed here because it needs a destination to point at,
  and inventing a docs URL would be worse than the gap. **Next action:** decide
  the target (`docs/zigbee-thread.md` has the supported-dongle table) and wire it.
- 🚧 Discovery against a real camera stays blocked until the Twin image is
  published — the endpoint shape is taken from `electron.md` and unverified.
