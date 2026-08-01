# Repository Structure

> Start at **[CLAUDE.md](CLAUDE.md)** for the documentation map, product intent and the platform traps.
> Current build state is in **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)**.

```bash
raspberry-pi-iot-hub/
|-- CLAUDE.md                          # Product intent, hard constraints, platform traps — read first
|-- IMPLEMENTATION_STATUS.md           # Running record of what is built and verified
|-- README.md                          # Main documentation (Raspberry Pi OS image)
|-- README_MATTER.md                   # Matter protocol setup
|-- README_OTBR.md                     # OpenThread Border Router setup
|-- README_ZIGBEE.md                   # Zigbee2MQTT setup (installs Mosquitto)
|-- REPOSITORY_STRUCTURE.md            # This file
|
|-- scripts/                           # Installation and maintenance
|   |-- install-ubuntu.sh              # Idempotent installer for the Ubuntu Server build
|   |-- install-radios.sh              # Zigbee/Thread dongles, Mosquitto, Z2M, OTBR
|   |-- concentrator-reset.c           # GPIO chardev reset helper (replaces sysfs reset_lgw.sh)
|   |-- reset_lgw.sh                   # Shim redirecting sx1302_hal's reset call to the helper
|   |-- detect-concentrator.sh         # Identifies the LoRa card, writes concentrator.env
|   |-- detect-radios.sh               # Identifies Zigbee/Thread dongles, writes radios.env
|   |-- iot-hub-radio-role             # udev PROGRAM helper: serial -> zigbee|thread role
|   |-- sx1302_hal-optional-temp-sensor.patch  # Makes the missing STTS751 non-fatal
|   `-- fix_certs.sh                   # Certificate line-ending and permission fixer
|
|-- config/                            # Configuration and service definitions
|   |-- README.md                      # What each template is, and its non-obvious constraints
|   |-- concentrator.conf              # LoRa GPIO pins -> /etc/iot-hub/concentrator.conf
|   |-- station.conf.template          # Basic Station radio config (region-free)
|   |-- radios.conf                    # USB serial -> zigbee|thread role map
|   |-- mosquitto.conf                 # Broker: loopback listener + commented Chirp bridge
|   |-- zigbee-configuration.yaml.template  # Zigbee2MQTT config, rendered at onboarding
|   |-- udev/
|   |   `-- 99-iot-hub-radios.rules    # Role symlinks, ModemManager exclusion, dialout access
|   |-- iot-hub-lorawan.service        # Gated on tc.uri
|   |-- iot-hub-mqtt.service           # Mosquitto; ungated
|   |-- iot-hub-zigbee.service         # Gated on /dev/zigbee + configuration.yaml
|   |-- iot-hub-thread.service         # Gated on /dev/thread
|   |-- iot-hub-zigbee-restart.service # udev-triggered replug recovery
|   |-- iot-hub-thread-restart.service # udev-triggered replug recovery
|   |-- basicstation.service           # Raspberry Pi OS unit (legacy, /home/iotmaster paths)
|   |-- webconfig.service              # Web config unit (legacy, /home/iotmaster paths)
|   `-- config.json                    # Legacy EU868 station.conf — reference only, not on any live path
|
|-- docker/                            # One directory per service, mirroring /opt/iot-hub
|   |-- lorawan/docker-compose.yml     # Basic Station (region-agnostic)
|   |-- mqtt/docker-compose.yml        # Mosquitto 2.1.2
|   |-- zigbee/docker-compose.yml      # Zigbee2MQTT 2.12.1
|   `-- thread/docker-compose.yml      # OpenThread Border Router (digest-pinned)
|
|-- docs/
|   |-- ubuntu-2604.md                 # Ubuntu Server build: GPIO chardev, temp sensor, provisioning
|   |-- zigbee-thread.md               # Dongle support, stable device names, MQTT topology
|   |-- camera-capacity.md             # Measured camera limits per board, and the method behind them
|   |-- hardware-setup.md              # Hardware assembly
|   |-- software-setup.md              # Raspberry Pi OS manual install
|   |-- configuration.md               # Region configuration reference (EU868/US915)
|   |-- api.md                         # webconfig HTTP API
|   `-- troubleshooting.md             # Common issues
|
|-- webconfig/                         # Web provisioning interface (Go) — predecessor of the Electron app
|   |-- main.go                        # HTTP server: gateway EUI, certificate upload, restart
|   |-- go.mod
|   |-- README.md
|   `-- static/
|       |-- index.html
|       `-- style.css
|
|-- chirp_bridge/                      # MQTT bridge between the local broker and Chirp cloud
|   |-- main.go                        # Bidirectional topic-prefix bridge (paho)
|   |-- config.yaml                    # Manual mode config; auto mode reads Zigbee2MQTT's config
|   |-- go.mod
|   |-- go.sum
|   `-- README.md
|
`-- fw/                                # Prebuilt firmware for companion radios
    `-- nrf52840_dongle/openthread/     # OpenThread RCP image for the nRF52840 dongle
```

## Directory Descriptions

### `/scripts`
Installation and maintenance. `install-ubuntu.sh` is the entry point for the Ubuntu Server build and is
safe to re-run. `concentrator-reset.c` is compiled to `/usr/local/bin/concentrator-reset`; it exists
because the sysfs GPIO ABI these boards' vendor scripts rely on was removed in kernel 7.x.

### `/config`
Configuration templates and systemd units. Note that files here are **templates installed to `/etc`**,
not live configuration — `tc.crt`, `tc.key`, `tc.trust` and `tc.uri` are runtime credentials written
during onboarding and are correctly absent from the repository.

### `/docker`
The Basic Station container definition. Deliberately contains no region or channel plan: Basic Station
receives those from the LNS.

### `/webconfig`
Go web interface for uploading credentials and displaying the gateway EUI. This is the working
predecessor of the planned Electron onboarding app.

### `/chirp_bridge`
Go MQTT bridge that mirrors topics between the on-device broker and Chirp's cloud broker. Independent of
LoRaWAN — it serves the Zigbee2MQTT side.

### `/fw`
Prebuilt firmware images for companion radios, currently the nRF52840 dongle's OpenThread RCP build.

## On-device layout

Repository paths do not map one-to-one onto the device. On the Ubuntu build:

| Repository | Installed to |
|---|---|
| `scripts/concentrator-reset.c` | `/usr/local/bin/concentrator-reset` (compiled) |
| `scripts/detect-concentrator.sh` | `/usr/local/bin/detect-concentrator.sh` |
| `config/concentrator.conf` | `/etc/iot-hub/concentrator.conf` |
| `config/iot-hub-lorawan.service` | `/etc/systemd/system/iot-hub-lorawan.service` |
| `docker/lorawan/docker-compose.yml` | `/opt/iot-hub/lorawan/docker-compose.yml` |
| `docker/{mqtt,zigbee,thread}/docker-compose.yml` | `/opt/iot-hub/{mqtt,zigbee,thread}/docker-compose.yml` |
| `scripts/iot-hub-radio-role` | `/usr/local/bin/iot-hub-radio-role` |
| `scripts/detect-radios.sh` | `/usr/local/bin/detect-radios.sh` |
| `config/udev/99-iot-hub-radios.rules` | `/etc/udev/rules.d/99-iot-hub-radios.rules` |
| `config/radios.conf` | `/etc/iot-hub/radios.conf` |
| `config/mosquitto.conf` | `/etc/iot-hub/mqtt/mosquitto.conf` |
| — (generated) | `/etc/iot-hub/concentrator.env`, `/etc/iot-hub/radios.env` |
| — (generated) | `/dev/zigbee`, `/dev/thread` (udev role symlinks) |
| — (onboarding) | `/etc/iot-hub/lorawan/tc.{uri,trust,crt,key}` |
| — (onboarding) | `/etc/iot-hub/zigbee/configuration.yaml` |

The Raspberry Pi OS image instead places everything under `/home/iotmaster/`.

## Notes for Contributors

1. Keep documentation up to date with code changes.
2. **Update `IMPLEMENTATION_STATUS.md` as work lands**, not in a batch afterwards.
3. Follow the existing directory structure when adding new features.
4. Update this file when making structural changes.
5. Never add a region or channel plan to the device configuration — the LNS supplies it, and the image
   must serve every regional variant of the hardware.
6. For web interface changes: test locally before committing, update both frontend and backend
   documentation, and follow Go coding standards.
7. When adding new protocols or integrations, create a dedicated README file (e.g. `README_PROTOCOL.md`).
