#!/bin/bash
#
# install-radios.sh — Zigbee/Thread coordinator support for the IoT Hub image.
#
# Installs the udev layer that makes the popular dongles work out of the box
# (stable device names, ModemManager exclusion, group access), plus the
# Mosquitto broker, Zigbee2MQTT and OpenThread Border Router as pinned Docker
# services.
#
# Everything is installed READY BUT UNPROVISIONED: the Zigbee service waits for
# a configuration file and the Thread service waits for a second radio, so a
# freshly flashed image runs nothing it cannot run properly.
#
# Called by install-ubuntu.sh; also safe to run on its own, and safe to re-run.
#
# Usage:
#   sudo ./install-radios.sh [--skip-pull]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ETC_DIR="/etc/iot-hub"
OPT_DIR="/opt/iot-hub"
VAR_DIR="/var/lib/iot-hub"

# Pinned deliberately. "latest" in an image people flash means two units built a
# month apart behave differently, with no way to tell from the device.
MOSQUITTO_IMAGE="eclipse-mosquitto:2.1.2-alpine"
ZIGBEE2MQTT_IMAGE="koenkk/zigbee2mqtt:2.12.1"
OTBR_IMAGE="openthread/otbr@sha256:0cfccb10c3d5f878028e07ea4f652f72fc967592ee9591978c41dcced0ede4e6"

SKIP_PULL=0
for arg in "$@"; do
    case "$arg" in
        --skip-pull) SKIP_PULL=1 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

step() { printf '\n=== %s\n' "$*"; }

# ---------------------------------------------------------------------------
step "Prerequisites"

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
for _ in $(seq 1 120); do
    fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
    sleep 5
done

# mosquitto-clients gives mosquitto_pub/_sub on the host for diagnostics without
# having to exec into the container.
apt-get update
apt-get -y install mosquitto-clients usbutils

command -v docker >/dev/null || { echo "docker is required; run install-ubuntu.sh first" >&2; exit 1; }

# ---------------------------------------------------------------------------
step "Radio device rules"

install -d "$ETC_DIR"
install -m 0755 "$REPO_DIR/scripts/iot-hub-radio-role" /usr/local/bin/iot-hub-radio-role
install -m 0755 "$REPO_DIR/scripts/detect-radios.sh"   /usr/local/bin/detect-radios.sh

# Never clobber an operator's role assignments.
if [ ! -f "$ETC_DIR/radios.conf" ]; then
    install -m 0644 "$REPO_DIR/config/radios.conf" "$ETC_DIR/radios.conf"
else
    echo "keeping existing $ETC_DIR/radios.conf"
fi

install -m 0644 "$REPO_DIR/config/udev/99-iot-hub-radios.rules" \
    /etc/udev/rules.d/99-iot-hub-radios.rules

udevadm control --reload
udevadm trigger --subsystem-match=tty
udevadm settle --timeout=10 || true

# brltty claims CP2102 devices on Ubuntu and is a well-known cause of a Zigbee
# coordinator vanishing seconds after it is plugged in. It is not installed
# here, but a desktop metapackage would pull it in later, so hold it.
if ! dpkg -l brltty >/dev/null 2>&1; then
    apt-mark hold brltty >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
step "Detecting radios"

/usr/local/bin/detect-radios.sh || true

# ---------------------------------------------------------------------------
step "Container images"

if [ "$SKIP_PULL" -eq 0 ]; then
    docker pull "$MOSQUITTO_IMAGE"
    docker pull "$ZIGBEE2MQTT_IMAGE"
    docker pull "$OTBR_IMAGE"
fi

# ---------------------------------------------------------------------------
step "MQTT broker"

install -d "$ETC_DIR/mqtt" "$OPT_DIR/mqtt" "$VAR_DIR/mqtt/data"
# The eclipse-mosquitto image runs as uid/gid 1883.
chown -R 1883:1883 "$VAR_DIR/mqtt"

if [ ! -f "$ETC_DIR/mqtt/mosquitto.conf" ]; then
    install -m 0644 "$REPO_DIR/config/mosquitto.conf" "$ETC_DIR/mqtt/mosquitto.conf"
else
    echo "keeping existing $ETC_DIR/mqtt/mosquitto.conf"
fi

install -m 0644 "$REPO_DIR/docker/mqtt/docker-compose.yml" "$OPT_DIR/mqtt/docker-compose.yml"

# ---------------------------------------------------------------------------
step "Zigbee2MQTT"

install -d "$ETC_DIR/zigbee" "$OPT_DIR/zigbee"
install -m 0644 "$REPO_DIR/config/zigbee-configuration.yaml.template" \
    "$ETC_DIR/zigbee-configuration.yaml.template"
install -m 0644 "$REPO_DIR/docker/zigbee/docker-compose.yml" "$OPT_DIR/zigbee/docker-compose.yml"

# No configuration.yaml is rendered here. Its absence is what keeps the service
# inactive until onboarding, and Zigbee2MQTT rewrites that file at runtime to
# store the network key and paired devices — so generating it unprompted would
# risk overwriting a live Zigbee network.

# ---------------------------------------------------------------------------
step "Thread Border Router"

install -d "$ETC_DIR/thread" "$OPT_DIR/thread" "$VAR_DIR/thread"
install -m 0644 "$REPO_DIR/docker/thread/docker-compose.yml" "$OPT_DIR/thread/docker-compose.yml"

# Resolve the real upstream interface rather than assuming eth0 (the image's
# default) or wlan0 (what README_OTBR.md hardcoded). Neither is safe on an
# image someone else flashes.
INFRA_IF="$(ip -o route show default 2>/dev/null | awk '{print $5; exit}')"
INFRA_IF="${INFRA_IF:-eth0}"

if [ ! -f "$ETC_DIR/thread/thread.env" ]; then
    cat > "$ETC_DIR/thread/thread.env" <<EOF
# OpenThread Border Router settings.
#
# INFRA_IF_NAME is the interface facing the home LAN, detected at install time.
INFRA_IF_NAME=$INFRA_IF

# Baud rate must match the RCP firmware flashed onto the Thread dongle:
#   460800   typical for Silicon Labs EFR32 RCP builds
#   1000000  typical for the nRF52840 dongle
RADIO_URL=spinel+hdlc+uart:///dev/thread?uart-baudrate=460800
EOF
    echo "wrote $ETC_DIR/thread/thread.env (INFRA_IF_NAME=$INFRA_IF)"
else
    echo "keeping existing $ETC_DIR/thread/thread.env"
fi

# ---------------------------------------------------------------------------
step "Services"

for unit in iot-hub-mqtt iot-hub-zigbee iot-hub-thread \
            iot-hub-zigbee-restart iot-hub-thread-restart; do
    install -m 0644 "$REPO_DIR/config/$unit.service" "/etc/systemd/system/$unit.service"
done
systemctl daemon-reload

# The restart helpers are udev-triggered only, so they are not enabled.
systemctl enable iot-hub-mqtt.service iot-hub-zigbee.service iot-hub-thread.service
systemctl start iot-hub-mqtt.service

# ---------------------------------------------------------------------------
step "Done"

# shellcheck disable=SC1091
[ -f "$ETC_DIR/radios.env" ] && . "$ETC_DIR/radios.env"

cat <<EOF

Zigbee radio:   ${ZIGBEE_PORT:-none detected}${ZIGBEE_MODEL:+  (${ZIGBEE_MODEL})}
Zigbee adapter: ${ZIGBEE_ADAPTER:-unknown}
Thread radio:   ${THREAD_PORT:-none detected}
Broker:         mosquitto on 127.0.0.1:1883

Inventory:      $ETC_DIR/radios.env
Role map:       $ETC_DIR/radios.conf
Z2M template:   $ETC_DIR/zigbee-configuration.yaml.template

Zigbee2MQTT is installed but UNPROVISIONED. To start it, render the template to
$ETC_DIR/zigbee/configuration.yaml with the port and adapter above, then:

    sudo systemctl start iot-hub-zigbee

Thread stays inactive until a second dongle running OpenThread RCP firmware is
plugged in and mapped to the "thread" role in $ETC_DIR/radios.conf.
EOF
