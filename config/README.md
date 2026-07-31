# config/

Templates installed to `/etc` by `scripts/install-ubuntu.sh`. Nothing here is live configuration.

| File | Installed to | Purpose |
|---|---|---|
| `station.conf.template` | `/etc/iot-hub/station.conf.template` | Rendered to `/etc/iot-hub/lorawan/station.conf` by `detect-concentrator.sh` |
| `concentrator.conf` | `/etc/iot-hub/concentrator.conf` | GPIO pins for `concentrator-reset` |
| `radios.conf` | `/etc/iot-hub/radios.conf` | USB serial → role map for `/dev/zigbee` and `/dev/thread` |
| `udev/99-iot-hub-radios.rules` | `/etc/udev/rules.d/` | Role symlinks, ModemManager exclusion, `dialout` access |
| `mosquitto.conf` | `/etc/iot-hub/mqtt/mosquitto.conf` | Broker config; loopback listener + commented Chirp bridge |
| `zigbee-configuration.yaml.template` | `/etc/iot-hub/zigbee-configuration.yaml.template` | Rendered to `/etc/iot-hub/zigbee/configuration.yaml` during onboarding |
| `iot-hub-lorawan.service` | `/etc/systemd/system/` | Gated on `tc.uri` |
| `iot-hub-mqtt.service` | `/etc/systemd/system/` | Mosquitto; ungated |
| `iot-hub-zigbee.service` | `/etc/systemd/system/` | Gated on `/dev/zigbee` **and** `configuration.yaml` |
| `iot-hub-thread.service` | `/etc/systemd/system/` | Gated on `/dev/thread` |
| `iot-hub-{zigbee,thread}-restart.service` | `/etc/systemd/system/` | udev-triggered; not enabled |
| `basicstation.service` | — | Legacy Raspberry Pi OS unit (`/home/iotmaster` paths) |
| `webconfig.service` | — | Legacy Raspberry Pi OS unit (`/home/iotmaster` paths) |
| `config.json` | — | Legacy EU868 station.conf. Reference only, not on any live path |

## radios.conf and the udev rules

Roles are keyed on **USB serial number**, never on `ttyUSB*` (enumeration-ordered) or on the bridge chip
(`10c4:ea60` is a generic CP2102 shared by thousands of unrelated products). `detect-radios.sh` writes
the entry itself for a single recognised coordinator; with two unmapped dongles it refuses to guess.

After editing by hand:

```bash
sudo udevadm control --reload && sudo udevadm trigger --subsystem-match=tty
sudo detect-radios.sh
```

## zigbee-configuration.yaml.template

The rendered file is **state, not configuration** — Zigbee2MQTT rewrites it to store the network key,
PAN ID and paired devices. Re-rendering it on a live hub destroys the Zigbee network and forces every
device to be re-paired. Back it up together with `coordinator_backup.json`.

## station.conf.template — three things not to break

JSON has no comment syntax and this file cannot carry pseudo-comments, so the constraints live here.

**1. Do not add top-level keys.** The Basic Station image parses this file with `jq` and iterates the
top-level values. Anything besides `SX1302_conf` and `station_conf` — including a `"_comment"` key —
makes that iteration fail with `jq: error … Cannot index array with string "device"`. The image then
cannot read the SPI device path, falls back to auto-discovery, decides the interface is USB, and dies
with `ERROR: /dev/ttyACM0 does not exist`. The reported symptom is nowhere near the cause.

**2. Do not add a channel plan.** This file holds *radio hardware* configuration only. Basic Station
receives frequencies and data rates from the LNS in its `router_config` message, which is what lets a
single image serve EU868, US915, AS923 and the rest. Adding frequencies here would tie the image to one
region and defeat the point of the project.

**3. `routerid` must be a valid EUI.** `detect-concentrator.sh` substitutes `__GATEWAY_EUI__` with the
EUI read from the concentrator chip. The image's own `station.corecell.conf` ships `"routerid": ""`,
which Basic Station rejects (`@.station_conf.routerid: Illegal EUI`) and then discards the whole file.

The file's presence is also what selects the container's **STATIC** mode, where credentials are read
from `tc.uri` / `tc.trust` / `tc.crt` / `tc.key` files — the flow Chirp issues. Without it the image
runs in DYNAMIC mode and refuses to start without a `TC_KEY` token, which certificate-based auth does
not have.

Radio values are Semtech CORECELL reference values for the SX1250 radios used by the RAK5146 and
RAK2287, taken from the image's own `station.corecell.conf`.
