# CLAUDE.md — Raspberry Pi IoT Hub

Guidance for Claude Code when working in this repository. This file records the context that is **not**
derivable from the code or git history. Read it before changing anything under `docker/`, `config/`, or
`scripts/`.

The monorepo-wide `../CLAUDE.md` covers the Go microservices and does not apply here — this repo is
firmware/image work, not a Clean Architecture Go service. Where the two conflict, this file wins for
files inside `raspberry-pi-iot-hub/`.

---

## Documentation map — start here

**This file is the index. Any new document must be added to the table below**, or it will not be found.

### Read first

| Document | What it answers |
|---|---|
| **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** | **"Where did we get to?"** Per-phase state, what is verified on hardware, open blockers, and what was deliberately left out. **Must be updated with every plan execution** — see Conventions |
| [REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md) | What every directory and file is, plus the repo → device path map (repo layout does **not** mirror the device) |
| [README.md](README.md) | Product overview. Describes the **Raspberry Pi OS** image; see the banner for what does not apply on Ubuntu |

### Build and operate

| Document | Covers |
|---|---|
| [docs/ubuntu-2604.md](docs/ubuntu-2604.md) | The Ubuntu Server build: GPIO chardev reset, the temperature-sensor patch, region-from-LNS, provisioning, GNSS opt-in |
| [docs/zigbee-thread.md](docs/zigbee-thread.md) | Zigbee/Thread dongles: supported hardware table, stable device names, network coordinators, MQTT topology, troubleshooting |
| [config/README.md](config/README.md) | What each config template is and the constraints that cannot live inside the files themselves (JSON has no comments) |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | The non-negotiable rules (region-agnostic, ship unprovisioned, stable device names, pinned images), testing bar, style |
| [LICENSE](LICENSE) | MIT, Copyright (c) 2025-2026 Chirp |
| [docs/hardware-setup.md](docs/hardware-setup.md) | Physical assembly |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common issues (Raspberry Pi OS era) |
| [docs/configuration.md](docs/configuration.md), [docs/api.md](docs/api.md), [docs/software-setup.md](docs/software-setup.md) | Region reference, webconfig HTTP API, manual Raspberry Pi OS install |

### Per-protocol (Raspberry Pi OS era — each carries a correction banner)

| Document | Note |
|---|---|
| [README_ZIGBEE.md](README_ZIGBEE.md) | Superseded by `docs/zigbee-thread.md`. Its `/dev/ttyACM0` and `adapter: zboss` are wrong for the common coordinators |
| [README_OTBR.md](README_OTBR.md) | Superseded for install by the Docker service. Its `INFRA_IF_NAME=wlan0` and port-80 web GUI are unsafe on a hub |
| [README_MATTER.md](README_MATTER.md) | Matter via OTBR; not yet revisited for the Ubuntu build |

### Component-local

| Document | Covers |
|---|---|
| [webconfig/README.md](webconfig/README.md) | The Go provisioning server — working predecessor of the Electron onboarding app |
| [chirp_bridge/README.md](chirp_bridge/README.md) | The MQTT local↔cloud bridge. Slated for replacement by Mosquitto's built-in bridge |

---

## What we are building and why

A **redistributable, open-source community image** for a Raspberry Pi IoT hub. Somebody downloads it,
flashes an SD card, plugs in their own RAK concentrator, and gets a working LoRaWAN gateway connected to
Chirp — with no Linux knowledge required.

One Pi is intended to carry, eventually:

- **LoRaWAN** — RAK5146 (SX1303) / RAK2287 (SX1302) on the RAK2287/5146 Pi HAT → Chirp LNS
- **Zigbee2MQTT** — nRF52840 dongle (`README_ZIGBEE.md`)
- **MQTT client** to Chirp (`chirp_bridge/`)
- **Lens twin** and IP cameras
- **Thread / Matter** (`README_OTBR.md`, `README_MATTER.md`)

It is also a candidate **retail product sold through Kilo Electronics** — a hub a customer can buy
assembled. Treat everything here as shipping to strangers, not as a personal box.

### Two constraints that drive nearly every technical decision

1. **Region-agnostic.** We do not know where an adopter lives. The same image must work with an EU868,
   US915, AS923, AU915 … card. **Never bake a channel plan into the image.** With Basic Station the LNS
   pushes the channel plan in its `router_config` message, so the gateway stores only *radio hardware*
   config (clock source, TX gain LUT, RSSI offsets). This is the main reason Basic Station was chosen
   over ChirpStack Concentratord, which needs a per-region `config.toml` picked on the device.
2. **Provisioning is deferred.** A freshly flashed card has no LNS credentials. The hardware layer must
   come up fully configured but **unprovisioned**, and start on its own once credentials appear. Hence
   `ConditionPathExists=` on the systemd unit rather than a crash-looping container.

### Planned, not yet built

- An **Electron onboarding app** that registers the gateway with Chirp and writes
  `tc.uri` / `tc.trust` / `tc.crt` / `tc.key`. `webconfig/main.go` is its working predecessor — read it
  first; it already does the whole flow over HTTP on `:8000`.

---

## MQTT topology — decided, do not re-litigate

The hub runs a **local Mosquitto broker**, and bridges **outbound** to Chirp as an `mqtt_cloud`
connection. Chirp exposes two connector types (`bff/pkg/api/v1/connection/dto.go`):

| Type | Broker | Client | Direction |
|---|---|---|---|
| `mqtt_cloud` | Chirp (`broker.chirpwireless.io`), issues `generated_username`/`generated_password` | the hub | outbound |
| `mqtt_external` | you | Chirp | inbound |

`mqtt_external` is wrong for this product: a hub sits behind home NAT, so Chirp could not dial in
without a public address, a port forward or a tunnel.

**Zigbee2MQTT is an MQTT client, not a broker** — it could in principle point straight at Chirp and skip
the local broker. Four reasons it does not:

1. Z2M accepts **exactly one** MQTT server. Point it at the cloud and nothing on the device — the
   onboarding app, local automation, the Lens twin — can subscribe to Zigbee events without a round
   trip to the internet.
2. WAN outage would take Zigbee down entirely. With a local broker, Zigbee keeps working and the bridge
   (`cleansession false`) queues and replays.
3. Every other producer (LoRaWAN, camera twin, Matter) needs the same bus; one broker with one bridge
   beats each component holding its own cloud credentials.
4. Local control stays local — no internet round trip to switch a light in the same room.

**Mosquitto, not EMQX**, on the device: ~10 MB idle against EMQX's ~200 MB Erlang baseline, on a Pi that
also runs Basic Station, Z2M, OTBR and a camera twin. EMQX's advantage is throughput in the tens of
thousands of messages/second; a home hub does tens. EMQX remains the right choice **in the cloud**.

**MQTTX is a client, not an alternative to Mosquitto** — it is EMQX's GUI/CLI test tool. `mosquitto_pub`
/`mosquitto_sub` fill that role here (installed, ~200 KB, scriptable, no display needed). MQTTX is built
on MQTT.js, which is the natural library for the Electron app.

## Target platforms — two, and they are diverging

| | Original | Current build |
|---|---|---|
| OS | Raspberry Pi OS 64-bit | **Ubuntu 26.04 LTS Server arm64** |
| Delivery | pre-baked `.img` (S3 link in `README.md`) | built up over SSH, snapshotted later |
| User | `iotmaster` | `hub` |
| Paths | `/home/iotmaster/…` | `/etc/iot-hub/`, `/opt/iot-hub/` (user-neutral) |
| GPIO ABI | sysfs `/sys/class/gpio` | **chardev `/dev/gpiochip*` only** |

Do not "fix" one platform's files into the other's shape. Raspberry Pi OS files (`raspi-config`
instructions, `/home/iotmaster` paths) are historical and still describe the published image.

**Dev access:** `ssh pi` → `hub@iot-hub.local` (currently `192.168.2.199`). Passwordless sudo. `hub` is
in `dialout`, which owns `/dev/spidev0.0` and `/dev/gpiochip0`, so **the concentrator needs no root at
runtime**. See the "Raspberry Pi IoT hub" section of the global `~/.claude/CLAUDE.md` for card/image
build notes.

---

## The kernel 7.x GPIO trap — the single most expensive thing to rediscover

**`/sys/class/gpio` does not exist on Ubuntu 26.04 (kernel 7.0.0-raspi).** The sysfs GPIO ABI is gone.
Three things that look authoritative are therefore **dead on this platform**:

- this repo's `RESET_GPIO=529` in `docker/docker-compose.yml` (529 = 512 + GPIO17 sysfs base numbering)
- upstream `Lora-net/sx1302_hal/tools/reset_lgw.sh` — pure sysfs, no fallback
- the sysfs branch of RAK's `rak_common_for_gateway` reset script

The fix is `scripts/concentrator-reset.c` → `/usr/local/bin/concentrator-reset`, which drives the reset
line through the **GPIO chardev v2 ioctl ABI** (`GPIO_V2_GET_LINE_IOCTL` +
`GPIO_V2_LINE_SET_VALUES_IOCTL`) with **no libgpiod link dependency** — so the same binary can be
bind-mounted straight into the Basic Station container, whose base image has no GPIO tooling.

**Why not just call `gpioset`:** libgpiod v2 (Ubuntu ships 2.2.1) changed the semantics. `gpioset`
holds the line and does *not* exit by default, and when it does exit the line is **released** and its
level is no longer guaranteed. A pulse built from separate `gpioset` invocations is therefore racy and
its final state is undefined. One process holding the line request across the whole sequence is correct;
a shell script cannot do that.

Symptom if someone reintroduces the sysfs path: `cannot create /sys/class/gpio/gpio17/value: Directory
nonexistent`, followed by the concentrator failing to answer on SPI.

---

## Hardware facts worth not re-deriving

- **RAK5146 = SX1303**, **RAK2287 = SX1302**. Both are Semtech **CORECELL** design and both are served by
  `sx1302_hal` and by Basic Station's corecell variant. `DESIGN=CORECELL`.
- **Reset = line 17 on the SoC pinctrl chip.** On the RAK2287/5146 Pi HAT that is the only line wired —
  power-enable, SX1261 reset and AD5338R reset are *not* used, unlike the Semtech reference design
  (which uses 23 / 18 / 22 / 13). `concentrator-reset` supports them but leaves them unset by default.
- **Resolve the GPIO chip at runtime, never hardcode `gpiochip0`.** Walk
  `/sys/bus/gpio/devices/*/of_node` and match the SoC node (`soc/gpio@…`). On this Pi 4,
  `gpiochip0` → `/soc/gpio@7e200000` and `gpiochip1` is the firmware expander — but a Pi 5 exposes the
  same controller as `gpiochip4`, and kernel updates have moved it before.
- **Gateway EUI comes from the concentrator chip ID** (`util_chip_id`), not the eth0 MAC. `README.md` and
  `webconfig/main.go` both derive it from the MAC; that is wrong for a redistributed image, because the
  ID must follow the *card* and stay unique when an adopter changes network hardware.
- **SPI is already enabled** on the Ubuntu card (`dtparam=spi=on`, `/dev/spidev0.0`). No `raspi-config`
  step is needed — and `raspi-config` does not exist on Ubuntu anyway.
- **GNSS is opt-in and costs Bluetooth.** The RAK5146 has GNSS, but reaching it needs
  `dtoverlay=disable-bt` in `/boot/firmware/config.txt` plus freeing `ttyS0` from `serial-getty` to get
  `/dev/ttyAMA0`. A hub also running Zigbee/Thread/Matter may want Bluetooth more than PPS. Off by
  default; Basic Station's `time_fallback` covers timing.

## The second trap: the missing temperature sensor

Semtech's HAL requires an **STTS751 temperature sensor on I2C** and treats its absence as fatal in SPI
mode. **The RAK5146 does not have one** (nor does the RAK2287). Out of the box you get:

```
INFO: no temperature sensor found on port 0x39/0x3B/0x38
ERROR: no temperature sensor found.
ERROR: failed to start the gateway
```

This reads like a dead card. It is not — verified with `i2cdetect -y 1`, which returns a completely
empty bus. Upstream issue: [sx1302_hal#58](https://github.com/Lora-net/sx1302_hal/issues/58).

`scripts/sx1302_hal-optional-temp-sensor.patch` makes the sensor optional and falls back to 25 °C. The
reading only feeds RSSI temperature compensation, so the cost is a small RSSI error rather than a
gateway that refuses to start. RAK's own HAL fork does the same thing. **Any runtime built on
libloragw — Basic Station's corecell variant included — needs this patch or an equivalent.**

Related and easy to misread: **installing `i2c-tools` changes `/dev/i2c-1` from group `dialout` to a
new `i2c` group.** A user who could open the bus before suddenly cannot, and "sensor absent" turns into
"permission denied" with a near-identical symptom. Add the service user to `i2c`.

### Verifying the radio, in order

```bash
sudo /usr/local/bin/concentrator-reset start
util_chip_id -d /dev/spidev0.0        # prints concentrator EUI  <- the hardware pass/fail gate
test_loragw_hal_rx -d /dev/spidev0.0  # proves the RF path actually receives
```

`sx1302_hal` is built **only as a verification tool**. Basic Station is the runtime forwarder — do not
wire `lora_pkt_fwd` into the image.

## What the Basic Station container already handles — do not duplicate it

Verified against `xoseperez/basicstation:latest` (Station 2.0.6, sx1302_hal 2.1.0) on this hardware:

- It ships **libgpiod 1.6.3** and a `reset.sh.gpiod` template, auto-selects it when `gpioset` exists, and
  locates the chip with `gpiodetect | grep pinctrl`. It resets the concentrator itself.
- Its bundled HAL is **already patched** for boards without a temperature sensor — its `chip_id` reads
  the EUI cleanly where a stock host build fails.
- `RESET_GPIO=17` is its own default (`RESET_PIN` 11 → BCM 17 via its pin map).

So the container needs **neither `concentrator-reset` bind-mounted nor our HAL patch**. Both exist for the
host-side verification tools. Do not add a `/sys` bind mount, `privileged: true`, or a
`STATION_RADIOINIT` override — all three were in the old compose file and none is needed.

### STATIC vs DYNAMIC mode — the one that will bite hardest

The image has two credential modes and picks between them by a single test: **does `station.conf` exist
in the config directory?**

| | Selected by | Credentials come from | Fails with |
|---|---|---|---|
| **STATIC** | `station.conf` present | `tc.uri` / `tc.trust` / `tc.crt` / `tc.key` **files** | missing files |
| **DYNAMIC** | no `station.conf` | `TC_KEY` **environment variable** (a token) | `ERROR: Missing configuration … define valid TC_KEY` |

**Chirp issues certificates, not a token, so this deployment must be in STATIC mode** — which means
`station.conf` must exist. Drop the credential files in without it and the container restart-loops
complaining about `TC_KEY`, which points nowhere near the real cause.

`station.conf` is rendered from `config/station.conf.template` by `detect-concentrator.sh`. Two traps
inside that file, both of which cost real time — the details are in `config/README.md`:

- **`routerid` must be a valid EUI.** The image's own `station.corecell.conf` ships `"routerid": ""`,
  which Basic Station rejects (`@.station_conf.routerid: Illegal EUI`) and then discards the whole file.
  The template carries `__GATEWAY_EUI__` for substitution.
- **No extra top-level keys — not even a `"_comment"`.** The image reads this file with `jq` and
  iterates the top-level values. Anything besides `SX1302_conf` and `station_conf` breaks it with
  `jq: error … Cannot index array with string "device"`, after which the image cannot find the SPI
  device, falls back to auto-discovery, decides the interface is USB, and dies on
  `/dev/ttyACM0 does not exist`. The symptom is three steps removed from the cause.

Also drop `"gps"` and `"pps"` from `station_conf` while GNSS is off: `"gps": ""` makes Basic Station try
to open `./` as a TTY and log a `GPS:CRIT` line on every start. `HAS_GPS=0` in the compose file does not
suppress it, because that variable only affects the image's own wrapper.

Two constraints that are easy to get wrong:

- **`/app/config` must be mounted read-write.** The image writes `reset.sh`, `reset_lgw.sh` and
  `station.conf` there on every start; a read-only mount fails in a way that does not point at the mount.
- **The credential check runs before concentrator detection.** An unprovisioned container restart-loops
  on `ERROR: Missing configuration` and never touches the radio — which is why the systemd unit gates on
  `tc.uri` instead of letting Docker's restart policy churn.

---

## Zigbee/Thread radios — what already works, so you don't redo it

**The USB drivers were never the problem.** `cp210x`, `ch341`, `ftdi_sio`, `cdc_acm` and `pl2303` are
all in the stock Ubuntu kernel. Any guide telling you to build a Silicon Labs or WCH driver is out of
date for this platform. What actually breaks coordinators is the environment around the driver, and all
four causes are handled in `config/udev/99-iot-hub-radios.rules`:

- **ModemManager** probes serial ports and can wedge a Zigbee NCP → `ID_MM_DEVICE_IGNORE=1`.
- **brltty** claims CP2102 devices on Ubuntu → package held.
- **`ttyUSB*` is enumeration-ordered**, so two dongles swap roles across a reboot → role symlinks.
- **Permissions** → `GROUP="dialout", MODE="0660"`.

**Always use `/dev/zigbee` and `/dev/thread`, never `/dev/ttyUSB*`.** Roles are pinned per USB serial in
`/etc/iot-hub/radios.conf`, so they follow the physical dongle across ports and reboots.

Role matching is deliberately two-layered: ModemManager exclusion matches broadly by bridge-chip vendor
(safe — none are modems), but **role assignment never matches on the bridge chip alone**. `10c4:ea60` is
a generic CP2102 found on thousands of unrelated boards; claiming one as the Zigbee radio would be worse
than asking. Brand-specific descriptors auto-claim, generic ones are reported for manual mapping.

Other things worth not rediscovering:

- **`ZIGBEE_ADAPTER` in `/etc/iot-hub/radios.env`** is derived from the USB descriptor
  (`ember`/`zstack`/`deconz`/`zboss`). The wrong adapter is the most common Z2M misconfiguration. Where
  the descriptor is inconclusive the field is left **empty on purpose** — empty prompts a question, wrong
  fails confusingly.
- **Docker resolves a device symlink at container start**, so a replug onto a different `ttyUSB*` leaves
  a stale node and Z2M reports the adapter unresponsive. `iot-hub-zigbee-restart.service` is
  udev-triggered to handle it; it only acts if the service was already running.
- **Zigbee2MQTT's `configuration.yaml` is state, not config.** Z2M rewrites it to store the network key,
  PAN ID and pairings. Never regenerate it from the template on a live hub — the network is lost and
  every device must be re-paired. Back it up with `coordinator_backup.json`.
- **One radio cannot do Zigbee and Thread.** Different firmware; two dongles. The old
  `README_ZIGBEE.md`/`README_OTBR.md` both claimed `/dev/ttyACM0` for the same dongle, which cannot work.
- **Broker and Z2M frontend bind loopback only.** An anonymous broker on `0.0.0.0` would let anyone on
  the network control every Zigbee device in the home — unacceptable for an image strangers flash.
- **Network coordinators** (SLZB-06U, Dongle Max over PoE) need no drivers at all —
  `port: tcp://host:6638`. mDNS already resolves via `systemd-resolved`.

## Known-stale and known-broken spots

Do not treat these as intentional; do not copy their patterns.

- **`webconfig/main.go`** — two real bugs. `updateDockerCompose()` reads the compose file from
  `/home/iotmaster/config/` when it actually lives in `/home/iotmaster/basicstation-docker/`, and it
  rewrites a `SERVER:` key that does not exist in the file (compose uses `TC_URI`). Fix before using it
  as the Electron app's reference.
- **`config/config.json`** — a full EU868 `station.conf`. **Not on any live code path** (compose does not
  mount it; the container generates its own config from env vars). Legacy/reference only, and its
  hardcoded EU868 radio frequencies conflict with the region-agnostic goal. Grep before assuming it is
  used.
- **`REPOSITORY_STRUCTURE.md`** — stale. Omits `chirp_bridge/` and `fw/`; lists `config/tc.crt`,
  `tc.key`, `tc.trust`, `tc.uri` which are not in the repo (they are runtime files, correctly absent).
- **`scripts/fix_certs.sh`** — copies certs to `/opt/basicstation/`, inconsistent with the
  `/home/iotmaster/config` path used everywhere else.
- **`README.md`** — two documents concatenated (the second starts at "# Senses IoT Hub"), with duplicated
  "Image Contents" and "Quick Start" sections. It also contradicts itself on the reset pin: prose says
  GPIO 17, compose says `RESET_GPIO=529`. Links `docs/CONTRIBUTING.md` and `LICENSE`, neither of which
  exists.
- **`config/*.service`** — hardcode `/home/iotmaster/…`, so they do not work on the Ubuntu build.

---

## Before any image is redistributed — blockers

- `/boot/firmware/network-config` on the current card holds the **home Wi-Fi PSK in plaintext**. Strip it
  before any snapshot leaves the house.
- SSH on the current card is **key-only** with keys no adopter will hold — a flashed image would lock
  them out entirely. Needs either `ssh_pwauth` with a documented default password, or a first-boot flow
  that injects the adopter's own key.
- Default credentials in `README.md` (`iotmaster` / `123qweASD`) belong to the old published image. Do
  not carry them into a new one.

---

## Conventions

- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) must be updated with every plan execution.** It
  is the answer to "where did we get to?" at the start of a new session, and it is only worth reading if
  it is true. Update it *as* steps complete, not in a batch at the end — a session that is interrupted
  mid-way must still leave an accurate record. Mark items done only once they are **verified on the
  device**, not once the code is written. When something is blocked, name the blocker, the owner and the
  next concrete action. Refresh the "Last updated" date in the same edit.
- **Every new document must be added to the Documentation map at the top of this file**, and structural
  changes to [REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md). A document nobody can find is worse
  than no document, because it still has to be maintained. Both files went stale once already — the
  structure map had omitted `chirp_bridge/` and `fw/` while listing credential files that were never in
  the repo.
- **Keep cross-links live.** When a doc is superseded, add a banner at its top pointing at the
  replacement rather than deleting it — the Raspberry Pi OS documents still describe the published
  image and people are using it.
- **US English** everywhere: code, comments, docs, commit messages.
- Branch off `main` with a plain descriptive name. This repo has no Jira history and no `CHIRP-xxxx`
  keys — do not invent them.
- **No tool attribution anywhere** — not in commits, PR bodies, docs, or generated files. No
  `Co-Authored-By`, no "generated with" footer. This applies to the PR body as well as the commit
  message; check them separately.
- Commit only after the change is verified on the actual Pi. Do not push unless asked.
- Shell scripts intended for the image must be **idempotent** — an adopter may re-run the installer, and
  we re-run it constantly during development.
