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

# Paths, group, modes and helper names come from the shared definitions so this
# installer and the helpers it installs cannot drift apart.
# shellcheck source=lib/iot-hub-definitions.sh
. "$REPO_DIR/scripts/lib/iot-hub-definitions.sh"

ETC_DIR="$IOT_HUB_ETC_DIR"
OPT_DIR="$IOT_HUB_OPT_DIR"
VAR_DIR="$IOT_HUB_VAR_DIR"

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

# The group that may READ hub state without being able to replace it. The
# onboarding app has to inspect an existing Zigbee configuration to tell whether
# it is compatible with what the user is asking for; it must never be able to
# overwrite one, because that file holds the network key and every pairing.
if ! getent group "$IOT_HUB_GROUP" >/dev/null; then
    groupadd --system "$IOT_HUB_GROUP"
    echo "created group $IOT_HUB_GROUP"
fi

# Whoever invoked sudo is the person who will run the onboarding app.
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    if ! id -nG "$SUDO_USER" | tr ' ' '\n' | grep -qx "$IOT_HUB_GROUP"; then
        usermod -aG "$IOT_HUB_GROUP" "$SUDO_USER"
        echo "added $SUDO_USER to $IOT_HUB_GROUP (takes effect at their next login)"
    fi
fi

# ---------------------------------------------------------------------------
step "Radio device rules"

install -d "$ETC_DIR"

# The shared definitions must land before anything that sources them.
install -d /usr/local/lib/iot-hub
install -m 0644 "$REPO_DIR/scripts/lib/iot-hub-definitions.sh" \
    /usr/local/lib/iot-hub/definitions.sh

install -m 0755 "$REPO_DIR/scripts/iot-hub-radio-role"   "$IOT_HUB_RADIO_ROLE_CMD"
install -m 0755 "$REPO_DIR/scripts/detect-radios.sh"     "$IOT_HUB_DETECT_RADIOS_CMD"
install -m 0755 "$REPO_DIR/scripts/iot-hub-radio-assign" "$IOT_HUB_RADIO_ASSIGN_CMD"
install -m 0755 "$REPO_DIR/scripts/iot-hub-zigbee-config-create" \
    "$IOT_HUB_ZIGBEE_CONFIG_CREATE_CMD"

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

install -d "$OPT_DIR/zigbee"

# The ownership contract for the Zigbee data directory, which is bind-mounted
# into the container as /app/data and therefore holds the network key, the
# device database and the coordinator backup — not just configuration.yaml.
#
# root:iot-hub 2750 — the app reads, only the privileged helper creates, and
# Zigbee2MQTT keeps writing as container root. setgid so that the files
# Zigbee2MQTT creates here inherit the group and stay readable by the app.
install -d -o root -g "$IOT_HUB_GROUP" -m "$IOT_HUB_DIR_MODE" "$IOT_HUB_ZIGBEE_DIR"
chown root:"$IOT_HUB_GROUP" "$IOT_HUB_ZIGBEE_DIR"
chmod "$IOT_HUB_DIR_MODE" "$IOT_HUB_ZIGBEE_DIR"

# An install onto a device that already has a configuration must bring it into
# the contract too, or the app cannot read what is already there.
if [ -f "$IOT_HUB_ZIGBEE_CONFIG" ]; then
    chown root:"$IOT_HUB_GROUP" "$IOT_HUB_ZIGBEE_CONFIG"
    chmod "$IOT_HUB_CONFIG_MODE" "$IOT_HUB_ZIGBEE_CONFIG"
fi

install -m 0644 "$REPO_DIR/config/zigbee-configuration.yaml.template" \
    "$IOT_HUB_ZIGBEE_TEMPLATE"
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

Inventory:      $IOT_HUB_RADIOS_ENV
Role map:       $IOT_HUB_RADIOS_CONF
Z2M template:   $IOT_HUB_ZIGBEE_TEMPLATE

No radio is claimed automatically. A dongle gets /dev/zigbee only once it has
been assigned, which is the onboarding app's job and can also be done directly:

    sudo ${IOT_HUB_RADIO_ASSIGN_CMD##*/} <usb-serial> zigbee

Zigbee2MQTT is installed but UNPROVISIONED. To start it, render the template
with the port and adapter above and pipe it in — this creates the file once and
will not touch an existing one:

    ${IOT_HUB_ZIGBEE_CONFIG_CREATE_CMD##*/} < my-configuration.yaml
    sudo systemctl start iot-hub-zigbee

Thread stays inactive until a second dongle running OpenThread RCP firmware is
plugged in and assigned the "thread" role.
EOF
