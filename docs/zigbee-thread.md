# Zigbee and Thread dongles

How the IoT Hub image supports Zigbee/Thread USB coordinators out of the box, and how to add one that
is not yet recognised.

```bash
sudo ./scripts/install-radios.sh     # also run automatically by install-ubuntu.sh
detect-radios.sh                     # what is attached, and what adapter setting it needs
```

---

## The drivers are not the problem

Every common coordinator uses a USB-to-UART bridge whose driver is **already in the Ubuntu kernel** —
`cp210x`, `ch341`, `ftdi_sio`, `cdc_acm`, `pl2303`. Nothing needs installing, and any guide telling you
to build a Silicon Labs or WCH driver from source is out of date for this platform.

What actually breaks Zigbee coordinators on a stock Linux install is everything *around* the driver:

| Problem | What it looks like | Handled by |
|---|---|---|
| **ModemManager** probes the port | Coordinator wedges or fails to open at boot, works after a replug | `ID_MM_DEVICE_IGNORE=1` in the udev rules |
| **brltty** claims CP2102 devices | Dongle appears then vanishes a few seconds later | package held; not installed on this image |
| **`ttyUSB0` is not stable** | Two dongles swap roles after a reboot; a config points at the wrong radio | role symlinks `/dev/zigbee`, `/dev/thread` |
| **Permissions** | `EACCES` opening the port | `GROUP="dialout", MODE="0660"` |

## Stable device names

`/dev/ttyUSB0` is assigned in enumeration order, which changes with boot timing and USB port. On a hub
that may hold a Zigbee dongle, a Thread dongle and a LoRaWAN card, that is a bug waiting to happen.

The image therefore creates **role symlinks** driven by `/etc/iot-hub/radios.conf`, keyed on each
dongle's USB serial number:

```ini
f620d69ac39aef11aa72ad9061ce3355 = zigbee
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6 = thread
```

A role therefore follows the physical dongle across reboots, replugs and port changes. **Always use
`/dev/zigbee` and `/dev/thread` in configuration — never `/dev/ttyUSB*`.**

`detect-radios.sh` writes the map itself the first time it sees a single recognised coordinator, so the
common one-dongle case needs no editing. With two unmapped dongles it refuses to guess and prints the
serials to choose between.

### Replug behaviour

Docker resolves a device symlink to its target node when the container starts. If a coordinator is
unplugged and returns on a different `ttyUSB*`, a running container keeps the stale node and
Zigbee2MQTT reports the adapter as unresponsive. The udev rule triggers
`iot-hub-zigbee-restart.service` to handle this — it only acts if the service was already running, so
it will not resurrect something you deliberately stopped.

## Supported coordinators

| Dongle | Radio | USB bridge | Z2M `adapter` |
|---|---|---|---|
| SONOFF Dongle Plus MG24 | EFR32MG24 | CP2102N `10c4:ea60` | `ember` |
| SONOFF ZBDongle-E / Dongle Plus V2 | EFR32MG21 | CH9102 `1a86:55d4` | `ember` |
| SONOFF ZBDongle-P | CC2652P | CP2102N `10c4:ea60` | `zstack` |
| SONOFF Dongle Max (ZBDongle-M) | EFR32MG24 | USB or PoE Ethernet | `ember` |
| SMLIGHT SLZB-06U | CC2652P + ESP32-S3 | USB or PoE Ethernet | `zstack` |
| SMLIGHT SLZB-06Mg24U / Mg26U | EFR32MG24/26 | USB or PoE Ethernet | `ember` |
| SMLIGHT SLZB-07 | EFR32MG21 | CP2102N `10c4:ea60` | `ember` |
| Home Assistant SkyConnect / Connect ZBT-1 | EFR32MG21 | CP2102N `10c4:ea60` | `ember` |
| ConBee II | — | FTDI `0403:6015` | `deconz` |
| ConBee III | — | native CDC `1cf1:0030` | `deconz` |
| nRF52840 dongle (ZBOSS NCP) | nRF52840 | native CDC | `zboss` |

`detect-radios.sh` derives the adapter setting from the USB descriptor and reports it in
`/etc/iot-hub/radios.env`. **Choosing the wrong adapter is the most common Zigbee2MQTT
misconfiguration**, so read it from there rather than guessing. Where the descriptor is not conclusive
the field is left empty and the script says so — an empty value prompts a question, a wrong one fails
confusingly.

### Adding an unrecognised dongle

Generic descriptors are deliberately **not** auto-claimed. A bare "Silicon Labs CP2102N USB to UART
Bridge Controller" ships on thousands of unrelated boards, and silently treating one as the Zigbee radio
would be worse than asking. Map it by hand:

```bash
detect-radios.sh                       # prints the serial of anything unidentified
sudo nano /etc/iot-hub/radios.conf     # <serial> = zigbee
sudo udevadm control --reload && sudo udevadm trigger --subsystem-match=tty
sudo detect-radios.sh
```

Use `= ignore` for a USB-serial device that is not a radio, to keep it from being auto-claimed.

## Network-attached coordinators (PoE / Ethernet)

The SLZB-06U and SONOFF Dongle Max can run over Ethernet instead of USB, exposing the radio as a TCP
serial port. **No drivers, no udev rules, nothing to install** — point Zigbee2MQTT at it:

```yaml
serial:
  port: tcp://slzb-06.local:6638
  adapter: zstack
```

mDNS resolution already works (`systemd-resolved` has MulticastDNS enabled on every link), so the
`.local` name resolves without extra packages.

Prefer **PoE/Ethernet over Wi-Fi** for these. The serial-over-IP protocol has no tolerance for packet
loss or latency spikes, and a Wi-Fi coordinator produces intermittent, hard-to-diagnose dropouts.

## Zigbee and Thread together

**One radio cannot do both.** A Zigbee coordinator runs EmberZNet/zStack firmware; Thread needs
OpenThread RCP firmware. Serving both means either two dongles, or multiprotocol firmware — this image
uses **two dongles with dedicated firmware**, which is markedly more reliable.

> Older `README_ZIGBEE.md` and `README_OTBR.md` both claimed `/dev/ttyACM0` for the same nRF52840
> dongle. That configuration cannot work, and the role symlinks now make the conflict impossible to
> reproduce by accident.

Thread's service is gated on `/dev/thread` existing, so with no second dongle it stays cleanly inactive
and starts by itself once one is plugged in and mapped.

Set the baud rate in `/etc/iot-hub/thread/thread.env` to match the RCP firmware — `460800` for Silicon
Labs builds, `1000000` for the nRF52840.

## Services

| Unit | Container | Starts when |
|---|---|---|
| `iot-hub-mqtt` | `eclipse-mosquitto:2.1.2-alpine` | always |
| `iot-hub-zigbee` | `koenkk/zigbee2mqtt:2.12.1` | `/dev/zigbee` **and** a `configuration.yaml` exist |
| `iot-hub-thread` | `openthread/otbr` (digest-pinned) | `/dev/thread` exists |

Images are pinned, never `latest` — two units built a month apart must not behave differently with no
way to tell from the device. OTBR publishes only a `latest` tag, so it is pinned by **digest**.

### The broker listens on loopback only

`mosquitto.conf` binds `127.0.0.1:1883`, and Zigbee2MQTT's frontend binds `127.0.0.1:8080`. An
anonymous broker on `0.0.0.0` would let anyone on the network read and **control** every Zigbee device
in the home — not an acceptable default for an image strangers flash onto their own hardware. Containers
use host networking, so loopback reaches everything on the device.

To expose the broker, add authentication first:

```bash
sudo docker exec -it mosquitto mosquitto_passwd -c /mosquitto/config/passwd <user>
# then in mosquitto.conf: listener 1883 / allow_anonymous false / password_file …
```

## Provisioning Zigbee2MQTT

```bash
set -a; . /etc/iot-hub/radios.env; set +a
sudo sed -e "s|__ZIGBEE_PORT__|$ZIGBEE_PORT|" -e "s|__ZIGBEE_ADAPTER__|$ZIGBEE_ADAPTER|" \
    /etc/iot-hub/zigbee-configuration.yaml.template \
    | sudo tee /etc/iot-hub/zigbee/configuration.yaml >/dev/null
sudo systemctl start iot-hub-zigbee
```

Confirm it reached the radio:

```bash
mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/bridge/state -C 1
mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/bridge/info  -C 1
```

> **`configuration.yaml` becomes state, not config.** Zigbee2MQTT rewrites it at runtime to store the
> network key, PAN ID and paired devices. Back it up (along with `coordinator_backup.json`); do not
> regenerate it from the template on a live hub, or the Zigbee network is lost and every device has to
> be re-paired.

### Starting over

```bash
sudo systemctl stop iot-hub-zigbee
sudo rm -rf /etc/iot-hub/zigbee/*        # destroys the network and all pairings
```

## Troubleshooting

**Coordinator not detected** — `lsusb` should list it; `detect-radios.sh` reports anything unidentified
with the serial to map. If `lsusb` shows nothing, it is cable or power, not software.

**Port opens then fails** — check nothing else holds it: `sudo fuser -v /dev/zigbee`. Confirm
ModemManager is excluded: `udevadm info -q property -n /dev/zigbee | grep ID_MM`.

**`Failed to connect to the adapter`** — almost always the wrong `adapter` value. Compare
`configuration.yaml` with `ZIGBEE_ADAPTER` in `/etc/iot-hub/radios.env`.

**Zigbee is flaky** — check channel overlap with Wi-Fi. Zigbee 11 collides with Wi-Fi 1, and 25/26 sit
above most Wi-Fi; the template defaults to **15**. Changing channel later can drop battery devices that
do not follow.

**Container has a stale device** after a replug — `sudo systemctl restart iot-hub-zigbee`. If that is
needed routinely, the udev restart trigger is not firing: `udevadm monitor --udev --subsystem-match=tty`.
