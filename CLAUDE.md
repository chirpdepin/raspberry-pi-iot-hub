# CLAUDE.md — Raspberry Pi IoT Hub

Guidance for Claude Code when working in this repository. This file records the context that is **not**
derivable from the code or git history. Read it before changing anything under `docker/`, `config/`, or
`scripts/`.

The monorepo-wide `../CLAUDE.md` covers the Go microservices and does not apply here — this repo is
firmware/image work, not a Clean Architecture Go service. Where the two conflict, this file wins for
files inside `raspberry-pi-iot-hub/`.

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

- **`IMPLEMENTATION_STATUS.md` must be updated with every plan execution.** It is the answer to "where
  did we get to?" at the start of a new session, and it is only worth reading if it is true. Update it
  *as* steps complete, not in a batch at the end — a session that is interrupted mid-way must still
  leave an accurate record. Mark items done only once they are **verified on the device**, not once the
  code is written. When something is blocked, name the blocker, the owner and the next concrete action.
  Refresh the "Last updated" date in the same edit.
- **US English** everywhere: code, comments, docs, commit messages.
- Branch off `main` with a plain descriptive name. This repo has no Jira history and no `CHIRP-xxxx`
  keys — do not invent them.
- **No tool attribution anywhere** — not in commits, PR bodies, docs, or generated files. No
  `Co-Authored-By`, no "generated with" footer. This applies to the PR body as well as the commit
  message; check them separately.
- Commit only after the change is verified on the actual Pi. Do not push unless asked.
- Shell scripts intended for the image must be **idempotent** — an adopter may re-run the installer, and
  we re-run it constantly during development.
