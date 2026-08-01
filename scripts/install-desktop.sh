#!/bin/bash
#
# install-desktop.sh — minimal graphical session so Chirp Hub can run on the Pi.
#
# The Ubuntu Server image has no X, no Wayland and no window manager, so an
# Electron app cannot start on it at all. This adds the smallest session that
# will run one application well.
#
# ADDITIVE ONLY. The Pi must still boot and run headless with no monitor
# attached: every service verified in the LoRaWAN and Zigbee work keeps running
# whether or not anyone plugs a screen in. Nothing here touches radio or gateway
# configuration.
#
# Usage:
#   sudo ./install-desktop.sh [--user <name>] [--no-autologin]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_USER="${SUDO_USER:-hub}"
AUTOLOGIN=1

while [ $# -gt 0 ]; do
    case "$1" in
        --user) TARGET_USER="$2"; shift 2 ;;
        --no-autologin) AUTOLOGIN=0; shift ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
id "$TARGET_USER" >/dev/null 2>&1 || { echo "no such user: $TARGET_USER" >&2; exit 1; }

step() { printf '\n=== %s\n' "$*"; }

# ---------------------------------------------------------------------------
step "Graphical session"

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

for _ in $(seq 1 120); do
    fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
    sleep 5
done

apt-get update

# labwc rather than a full desktop: a Wayland compositor of a few MB that runs
# one application well, which is exactly this use case. Ubuntu Desktop would add
# ~2.5 GB and a login screen the user has no reason to see.
#
# seatd arbitrates device access without logind session complexity.
apt-get -y install --no-install-recommends \
    labwc \
    seatd \
    wlr-randr \
    fonts-dejavu-core \
    xwayland

systemctl enable --now seatd
usermod -aG video,input,render,seat "$TARGET_USER" 2>/dev/null || true

# ---------------------------------------------------------------------------
step "Session autostart"

install -d -o "$TARGET_USER" -g "$TARGET_USER" "/home/$TARGET_USER/.config/labwc"

# Chirp Hub launches with the session and is the only thing in it. Contract 3:
# the app is built to work fullscreen with no window chrome, so this is the same
# shape as Ubuntu Frame on Ubuntu Core later — a compositor swap, not a UI change.
printf '# Chirp Hub is the session. Nothing else starts here.\nchirp-hub &\n' \
    > "/home/$TARGET_USER/.config/labwc/autostart"
chown "$TARGET_USER:$TARGET_USER" "/home/$TARGET_USER/.config/labwc/autostart"

# ---------------------------------------------------------------------------
step "Launcher"

install -m 0644 "$REPO_DIR/config/chirp-hub.desktop" /usr/share/applications/chirp-hub.desktop

# ---------------------------------------------------------------------------
if [ "$AUTOLOGIN" -eq 1 ]; then
    step "Auto-login"

    # A user who plugs in a monitor should find the app already running. A login
    # prompt on an appliance is a password they were never given.
    install -d /etc/systemd/system/getty@tty1.service.d
    {
        printf '[Service]\n'
        printf 'ExecStart=\n'
        printf 'ExecStart=-/sbin/agetty --autologin %s --noclear %%I $TERM\n' "$TARGET_USER"
    } > /etc/systemd/system/getty@tty1.service.d/autologin.conf

    # Start the compositor on tty1 once logged in, but ONLY there — an SSH
    # session has no seat and no display, and must be unaffected so the Pi stays
    # fully usable headless.
    PROFILE="/home/$TARGET_USER/.bash_profile"
    if ! grep -q 'exec labwc' "$PROFILE" 2>/dev/null; then
        {
            printf '\n# Start the graphical session on the console only. Guarded so SSH\n'
            printf '# logins are unaffected and the Pi stays fully usable headless.\n'
            printf 'if [ -z "${WAYLAND_DISPLAY:-}" ] && [ "${XDG_VTNR:-0}" = "1" ]; then\n'
            printf '    exec labwc\n'
            printf 'fi\n'
        } >> "$PROFILE"
        chown "$TARGET_USER:$TARGET_USER" "$PROFILE"
    fi

    systemctl daemon-reload
fi

# ---------------------------------------------------------------------------
step "Done"

printf '\n'
printf 'A graphical session is installed for user "%s".\n\n' "$TARGET_USER"
printf 'Plug in a monitor and reboot: the Pi logs in on its own and Chirp Hub\n'
printf 'starts fullscreen. With no monitor attached nothing changes - the gateway,\n'
printf 'Zigbee and camera services run exactly as before.\n\n'
printf 'The app package itself is installed separately:\n'
printf '    sudo apt install ./chirp-hub_*_arm64.deb\n\n'
