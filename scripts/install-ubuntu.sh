#!/bin/bash
#
# install-ubuntu.sh — build the IoT Hub LoRaWAN layer on Ubuntu Server (arm64).
#
# Targets Ubuntu 24.04/26.04 on a Raspberry Pi 4/5. This is NOT the same path as
# the Raspberry Pi OS instructions in docs/software-setup.md — see CLAUDE.md for
# why the two platforms are kept separate. The most important difference: the
# sysfs GPIO ABI (/sys/class/gpio) is gone on these kernels, so the concentrator
# reset goes through the GPIO character device instead.
#
# Idempotent: safe to re-run. Nothing here is region-specific by design — the
# channel plan comes from the LNS, so the same install serves EU868, US915,
# AS923 and the rest.
#
# Usage:
#   sudo ./install-ubuntu.sh [--skip-upgrade] [--skip-docker]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${SRC_DIR:-/opt/iot-hub/src}"
ETC_DIR="/etc/iot-hub"
LORAWAN_ETC="$ETC_DIR/lorawan"
LORAWAN_OPT="/opt/iot-hub/lorawan"
SX1302_HAL_REPO="https://github.com/Lora-net/sx1302_hal.git"

SKIP_UPGRADE=0
SKIP_DOCKER=0
for arg in "$@"; do
    case "$arg" in
        --skip-upgrade) SKIP_UPGRADE=1 ;;
        --skip-docker)  SKIP_DOCKER=1 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

step() { printf '\n=== %s\n' "$*"; }

# ---------------------------------------------------------------------------
step "System packages"

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

# unattended-upgrades may hold the dpkg lock on a freshly booted image.
for _ in $(seq 1 120); do
    fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
    sleep 5
done

apt-get update
if [ "$SKIP_UPGRADE" -eq 0 ]; then
    apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold full-upgrade
fi
apt-get -y install build-essential git gpiod libgpiod-dev i2c-tools

# i2c-tools installs a udev rule that moves /dev/i2c-* from group "dialout" to a
# new "i2c" group. Without this the HAL's temperature-sensor probe fails with
# EACCES, which is indistinguishable in the logs from the sensor being absent.
TARGET_USER="${SUDO_USER:-}"
if [ -n "$TARGET_USER" ] && [ "$TARGET_USER" != "root" ]; then
    for grp in i2c dialout; do
        if getent group "$grp" >/dev/null; then
            usermod -aG "$grp" "$TARGET_USER"
        fi
    done
    echo "added $TARGET_USER to i2c and dialout (re-login required to take effect)"
fi

# ---------------------------------------------------------------------------
step "SPI interface"

CONFIG_TXT=/boot/firmware/config.txt
if [ -f "$CONFIG_TXT" ]; then
    if grep -qE '^\s*dtparam=spi=on' "$CONFIG_TXT"; then
        echo "SPI already enabled in $CONFIG_TXT"
    else
        echo "dtparam=spi=on" >> "$CONFIG_TXT"
        echo "SPI enabled in $CONFIG_TXT — a reboot is required"
        touch /var/run/reboot-required
    fi
else
    echo "warning: $CONFIG_TXT not found; cannot verify SPI" >&2
fi

# ---------------------------------------------------------------------------
step "Concentrator reset helper"

install -d "$ETC_DIR"
# Never clobber an existing config — an adopter may have retuned the pins for a
# non-RAK board.
if [ ! -f "$ETC_DIR/concentrator.conf" ]; then
    install -m 0644 "$REPO_DIR/config/concentrator.conf" "$ETC_DIR/concentrator.conf"
else
    echo "keeping existing $ETC_DIR/concentrator.conf"
fi

# Installed before the first detection run, which renders station.conf from it.
install -m 0644 "$REPO_DIR/config/station.conf.template" "$ETC_DIR/station.conf.template"

cc -O2 -Wall -Wextra -o /usr/local/bin/concentrator-reset \
    "$REPO_DIR/scripts/concentrator-reset.c"
chmod 0755 /usr/local/bin/concentrator-reset
/usr/local/bin/concentrator-reset info

# ---------------------------------------------------------------------------
step "sx1302_hal (verification tools only)"

# Built to prove the radio works — chip_id is the hardware pass/fail gate.
# Basic Station, not lora_pkt_fwd, is the runtime forwarder, and it ships its
# own HAL inside the container. Nothing built here is on the runtime path.
install -d "$SRC_DIR"
if [ -d "$SRC_DIR/sx1302_hal/.git" ]; then
    git -C "$SRC_DIR/sx1302_hal" checkout -- libloragw/src/loragw_hal.c 2>/dev/null || true
    git -C "$SRC_DIR/sx1302_hal" pull --ff-only || true
else
    git clone --depth 1 "$SX1302_HAL_REPO" "$SRC_DIR/sx1302_hal"
fi

# The RAK5146 has no STTS751 temperature sensor and upstream treats that as
# fatal, so the HAL will not start on this hardware unpatched. See
# https://github.com/Lora-net/sx1302_hal/issues/58 and docs/ubuntu-2604.md.
if grep -q "LGW_FALLBACK_TEMPERATURE" "$SRC_DIR/sx1302_hal/libloragw/src/loragw_hal.c"; then
    echo "temperature-sensor patch already applied"
else
    patch -p1 -d "$SRC_DIR/sx1302_hal" < "$REPO_DIR/scripts/sx1302_hal-optional-temp-sensor.patch"
fi

make -C "$SRC_DIR/sx1302_hal" -j"$(nproc)"

# Note the binary is util_chip_id/chip_id, not util_chip_id/util_chip_id.
install -m 0755 "$SRC_DIR/sx1302_hal/util_chip_id/chip_id" /usr/local/bin/util_chip_id
install -m 0755 "$SRC_DIR/sx1302_hal/libloragw/test_loragw_hal_rx" /usr/local/bin/test_loragw_hal_rx
install -m 0755 "$REPO_DIR/scripts/detect-concentrator.sh" /usr/local/bin/detect-concentrator.sh

# chip_id and the HAL tests shell out to ./reset_lgw.sh in their working
# directory. Upstream's copy is sysfs-based and dead on this kernel, so install
# a shim that redirects to the chardev helper.
install -m 0755 "$REPO_DIR/scripts/reset_lgw.sh" /usr/local/bin/reset_lgw.sh
for d in "$SRC_DIR/sx1302_hal" "$SRC_DIR/sx1302_hal/libloragw" "$SRC_DIR/sx1302_hal/util_chip_id"; do
    install -m 0755 "$REPO_DIR/scripts/reset_lgw.sh" "$d/reset_lgw.sh"
done

# ---------------------------------------------------------------------------
step "Concentrator detection"

/usr/local/bin/concentrator-reset start
if ! (cd "$SRC_DIR/sx1302_hal" && /usr/local/bin/util_chip_id -d /dev/spidev0.0); then
    echo
    echo "FAILED: the concentrator did not answer on /dev/spidev0.0." >&2
    echo "This is a hardware or wiring problem, not a software one. Check that" >&2
    echo "the card is fully seated in the HAT, the HAT is seated on the header," >&2
    echo "and RESET_PIN in $ETC_DIR/concentrator.conf matches your board." >&2
    exit 1
fi

/usr/local/bin/detect-concentrator.sh

# ---------------------------------------------------------------------------
if [ "$SKIP_DOCKER" -eq 0 ]; then
    step "Docker"
    apt-get -y install docker.io docker-compose-v2
    systemctl enable --now docker
fi

# ---------------------------------------------------------------------------
step "Basic Station"

# The config directory must be writable by the container: the image generates
# its reset script and station.conf in here on every start.
install -d "$LORAWAN_OPT" "$LORAWAN_ETC"
install -m 0644 "$REPO_DIR/docker/docker-compose.yml" "$LORAWAN_OPT/docker-compose.yml"

# station.conf was rendered from config/station.conf.template during detection,
# with the routerid filled in from the concentrator EUI. Its presence selects the
# container's STATIC mode, where credentials come from tc.* files rather than a
# TC_KEY token. It still contains no channel plan — that comes from the LNS.

install -m 0644 "$REPO_DIR/config/iot-hub-lorawan.service" \
    /etc/systemd/system/iot-hub-lorawan.service
systemctl daemon-reload
systemctl enable iot-hub-lorawan.service

# ---------------------------------------------------------------------------
step "Done"

cat <<EOF

Concentrator:  $(sed -n 's/^GATEWAY_EUI=//p' "$ETC_DIR/concentrator.env" 2>/dev/null || echo unknown)
Config:        $ETC_DIR/concentrator.conf, $ETC_DIR/concentrator.env
Compose:       $LORAWAN_OPT/docker-compose.yml
Credentials:   $LORAWAN_ETC/{tc.uri,tc.trust,tc.crt,tc.key}   <-- not yet present

The gateway is installed but UNPROVISIONED. iot-hub-lorawan.service will stay
inactive until tc.uri exists. To provision it, register the EUI above with Chirp,
then drop the four credential files into $LORAWAN_ETC and run:

    sudo systemctl start iot-hub-lorawan

EOF

if [ -f /var/run/reboot-required ]; then
    echo "A reboot is required to finish (kernel and/or SPI overlay)."
fi
