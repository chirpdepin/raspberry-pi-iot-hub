# Repository Structure

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
|   |-- concentrator-reset.c           # GPIO chardev reset helper (replaces sysfs reset_lgw.sh)
|   |-- reset_lgw.sh                   # Shim redirecting sx1302_hal's reset call to the helper
|   |-- detect-concentrator.sh         # Identifies the card and writes concentrator.env
|   |-- sx1302_hal-optional-temp-sensor.patch  # Makes the missing STTS751 non-fatal
|   `-- fix_certs.sh                   # Certificate line-ending and permission fixer
|
|-- config/                            # Configuration and service definitions
|   |-- concentrator.conf              # GPIO pin config -> /etc/iot-hub/concentrator.conf
|   |-- iot-hub-lorawan.service        # Ubuntu unit, gated on tc.uri existing
|   |-- basicstation.service           # Raspberry Pi OS unit (legacy, /home/iotmaster paths)
|   |-- webconfig.service              # Web config unit (legacy, /home/iotmaster paths)
|   `-- config.json                    # Legacy EU868 station.conf — reference only, not on any live path
|
|-- docker/
|   `-- docker-compose.yml             # Basic Station container (region-agnostic)
|
|-- docs/
|   |-- ubuntu-2604.md                 # Ubuntu Server build: GPIO chardev, temp sensor, provisioning
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
| `docker/docker-compose.yml` | `/opt/iot-hub/lorawan/docker-compose.yml` |
| — (generated) | `/etc/iot-hub/concentrator.env` |
| — (onboarding) | `/etc/iot-hub/lorawan/tc.{uri,trust,crt,key}` |

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
