# Running the IoT Hub on Ubuntu Server (arm64)

This guide covers Ubuntu Server 24.04/26.04 on a Raspberry Pi 4/5. It is a **separate path** from
[docs/software-setup.md](software-setup.md), which describes the original Raspberry Pi OS image. Do not
mix them — paths, users and the GPIO interface all differ.

Quick version:

```bash
git clone https://github.com/chirpdepin/raspberry-pi-iot-hub.git
cd raspberry-pi-iot-hub
sudo ./scripts/install-ubuntu.sh
```

The rest of this document explains what that does and why, because two of the decisions are
non-obvious and will otherwise be "fixed" back into something broken.

---

## The sysfs GPIO problem

**`/sys/class/gpio` does not exist on Ubuntu 26.04 (kernel 7.x).** The sysfs GPIO ABI was deprecated for
years and has now been removed. Every widely-copied concentrator reset script uses it:

- this repository's own `docker/docker-compose.yml`, via `RESET_GPIO=529`
- Semtech's [`sx1302_hal/tools/reset_lgw.sh`](https://github.com/Lora-net/sx1302_hal/blob/master/tools/reset_lgw.sh)
- the sysfs branch of RAK's `rak_common_for_gateway` reset script

All three fail on this platform. The symptom is

```
/sys/class/gpio/export: No such file or directory
cannot create /sys/class/gpio/gpio17/value: Directory nonexistent
```

followed by the concentrator never answering on SPI — which reads like a dead card, so it is worth
recognising.

The replacement is `scripts/concentrator-reset.c`, installed as `/usr/local/bin/concentrator-reset`. It
drives the reset line through the **GPIO character device** (`/dev/gpiochip*`) using the v2 ioctl ABI,
and links against nothing but libc — which matters, because the same binary is bind-mounted into the
Basic Station container, whose base image has no GPIO tooling of its own.

### Why not just call `gpioset`

Ubuntu ships libgpiod 2.x, where `gpioset` changed behaviour in a way that makes it unsuitable here:

- it **holds the line and does not exit** by default, and
- when it does exit, the kernel **releases the line**, so its level is no longer guaranteed.

A reset pulse built from separate `gpioset` invocations is therefore racy, and its final state is
undefined. The sequence has to be driven by a single process that keeps the line request open from start
to finish. A shell script cannot do that; roughly 200 lines of C can.

### Pin configuration

`/etc/iot-hub/concentrator.conf`:

```ini
RESET_PIN=17          # RAK2287/RAK5146 Pi HAT wires only this
POWER_EN_PIN=none
SX1261_RESET_PIN=none
AD5338R_RESET_PIN=none
PULSE_MS=100
#GPIO_CHIP=/dev/gpiochip0
```

Numbers are **BCM line offsets on the SoC controller** — not sysfs numbers (do not add 512) and not
physical header pins.

`GPIO_CHIP` is deliberately left unset. The helper resolves the controller at runtime by matching the
SoC device-tree node, because the chip index is not stable: on a Pi 4 the SoC controller is `gpiochip0`
(`gpiochip1` is the firmware expander), a Pi 5 exposes it as `gpiochip4`, and kernel updates have
renumbered it before. Hardcoding it is the second most common way to break this.

Check what was detected:

```bash
concentrator-reset info
```

On a board that is not a RAK Pi HAT, set the pins it actually wires. The Semtech CORECELL reference
design, for example, uses `POWER_EN_PIN=18`, `SX1261_RESET_PIN=22`, `AD5338R_RESET_PIN=13`.

---

## Why there is no region setting anywhere

This image is meant to be downloaded by anyone, anywhere, and used with whatever RAK card they bought.
Baking in a channel plan would mean one image per region.

It does not need to. **Basic Station receives its channel plan from the LNS**, in the `router_config`
message sent right after the gateway connects. The device stores only *radio hardware* configuration —
clock source, TX gain table, RSSI offsets — which is identical across regional variants of the same card.
The region is chosen server-side, in Chirp, when the gateway is registered.

So an EU868 card and a US915 card run **byte-identical configuration** on the Pi. Do not add a region to
`station.conf`, to the compose file, or to `detect-concentrator.sh`.

This is also why Basic Station was chosen over ChirpStack Concentratord for this image: Concentratord
needs a per-region `config.toml` selected on the device, which is the wrong shape for a
one-image-fits-all build.

The legacy `config/config.json` in this repository *does* contain EU868 frequencies. It is a reference
artifact from the Raspberry Pi OS image, is not on any live code path, and must not be revived here.

---

## Verifying the hardware

Do these in order. Each one rules out a different layer.

```bash
# 1. Reset line reachable and the pin mapping correct
sudo concentrator-reset info
sudo concentrator-reset start        # must exit 0

# 2. The concentrator answers on SPI  <-- the pass/fail gate
util_chip_id -d /dev/spidev0.0       # prints the concentrator EUI

# 3. The RF path actually receives
test_loragw_hal_rx -d /dev/spidev0.0 # real uplinks within a minute or two
```

If step 2 fails, it is a hardware or configuration problem — the card not fully seated in the mPCIe slot,
the HAT not seated on the header, or the wrong `RESET_PIN`. Installing a packet forwarder on top will not
help, and its logs will be misleading.

Step 3 is worth the extra minute: step 2 only proves the SPI bus and the digital side. A missing or
badly connected antenna passes step 2 and fails step 3.

---

## Provisioning

The installer deliberately leaves the gateway **unprovisioned**. `iot-hub-lorawan.service` carries

```ini
ConditionPathExists=/etc/iot-hub/lorawan/tc.uri
```

so on a freshly flashed card it sits inactive instead of crash-looping a container that has no
credentials. `systemctl status` reporting the condition as unmet is the correct state, not a fault.

To provision:

1. Register the EUI from `util_chip_id` (or `/etc/iot-hub/concentrator.env`) with Chirp, choosing the
   frequency plan for **your** region there.
2. Download `tc.trust`, `tc.crt`, `tc.key` and note the LNS URI.
3. Place them:

```bash
sudo install -m 0640 tc.trust tc.crt tc.key /etc/iot-hub/lorawan/
echo 'wss://lora-eu868.cloud.chirpwireless.io:443' | sudo tee /etc/iot-hub/lorawan/tc.uri
sudo systemctl start iot-hub-lorawan
```

### Why `station.conf` has to be there

The container chooses its credential mode by testing whether `station.conf` exists in the config
directory:

- **present → STATIC mode**, credentials read from `tc.uri` / `tc.trust` / `tc.crt` / `tc.key` files.
- **absent → DYNAMIC mode**, credentials read from a `TC_KEY` environment variable holding a token.

Chirp issues certificates rather than a token, so this deployment must be in STATIC mode. If you drop
the credential files in and the container restart-loops with

```
ERROR: Missing configuration, either force key-less CUPS with USE_CUPS=1 or define valid TC_KEY, ...
```

then `station.conf` is missing — run `sudo detect-concentrator.sh` to render it. `station.conf` also
carries `routerid`, which must be a valid EUI; the installer fills it from the concentrator chip. See
`config/README.md` before editing that file, as two of its constraints fail in misleading ways.

Certificates must be **PEM with Unix line endings and no trailing whitespace** — Basic Station rejects
CRLF silently enough to be annoying. `scripts/fix_certs.sh` exists for that.

```bash
docker compose -f /opt/iot-hub/lorawan/docker-compose.yml logs -f
```

### Gateway EUI

On this platform the EUI comes from the **concentrator chip ID**, not from the ethernet MAC as
`README.md` and `webconfig/main.go` describe. For a redistributed image the identifier has to follow the
card, and stay unique if the user changes network hardware. A MAC-derived EUI would also collide across
devices that reuse a cloned configuration.

---

## GNSS (optional, costs Bluetooth)

The RAK5146 has an onboard GNSS receiver, but reaching it on a Pi 4 means taking the UART away from
Bluetooth:

```bash
# /boot/firmware/config.txt
dtoverlay=disable-bt
```

```bash
sudo systemctl disable --now serial-getty@ttyS0
sudo reboot
```

`/dev/ttyAMA0` then carries NMEA. Weigh it against the rest of the hub: a device also running
Zigbee, Thread or Matter may want Bluetooth more than PPS timing. Basic Station's `time_fallback`
handles timing without GNSS, so this is off by default.

---

## Differences from the Raspberry Pi OS build

| | Raspberry Pi OS image | Ubuntu Server |
|---|---|---|
| User | `iotmaster` | whatever the adopter chose (`hub` on the reference unit) |
| Config | `/home/iotmaster/config` | `/etc/iot-hub/` |
| Compose | `/home/iotmaster/basicstation-docker` | `/opt/iot-hub/lorawan` |
| Enable SPI | `raspi-config` | `dtparam=spi=on` (no `raspi-config` on Ubuntu) |
| GPIO reset | sysfs, `RESET_GPIO=529` | chardev, `concentrator-reset` |
| Region | EU868 baked into `config.json` | none — supplied by the LNS |
| Gateway EUI | derived from eth0 MAC | read from the concentrator chip |

Paths under `/etc` and `/opt` are used instead of a home directory precisely so the image does not break
when someone renames the account.
