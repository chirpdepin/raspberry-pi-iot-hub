#!/bin/bash
#
# detect-radios.sh — inventory the attached Zigbee/Thread coordinators and write
# /etc/iot-hub/radios.env for the onboarding app and the service units.
#
# Companion to detect-concentrator.sh, which does the same job for the LoRaWAN
# card. Safe to re-run; the env file is rewritten from scratch each time.
#
# Also persists a serial-number -> role mapping in /etc/iot-hub/radios.conf the
# first time it sees a single unambiguous coordinator, so that the common
# one-dongle case needs no manual step, and so that adding a second dongle later
# cannot steal the first one's role.

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/iot-hub/radios.env}"
CONF="${IOT_HUB_RADIOS_CONF:-/etc/iot-hub/radios.conf}"

log() { printf '%s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# Map a dongle to its Zigbee2MQTT "adapter" setting.
#
# Getting this wrong is the single most common Zigbee2MQTT misconfiguration, so
# where the descriptor is not conclusive we return empty and say so rather than
# guessing — a wrong adapter fails in a confusing way, an empty one prompts a
# question.
#
#   ember  - Silicon Labs EFR32 running EmberZNet (MG21/MG24/MG26)
#   zstack - Texas Instruments CC2652/CC1352
#   deconz - dresden elektronik ConBee
#   zboss  - Nordic nRF52840 running ZBOSS NCP
# ---------------------------------------------------------------------------
adapter_for() {
    local ident="$1"
    case "$ident" in
        *mg24*|*mg21*|*mg26*|*zbdongle-e*|*dongle_plus_v2*|*skyconnect*|*zbt-1*|*slzb-06mu*|*slzb-07*)
            printf 'ember' ;;
        *zbdongle-p*|*cc2652*|*cc1352*|*slzb-06p*|*slzb-07p*)
            printf 'zstack' ;;
        *conbee*|*raspbee*|*dresden*)
            printf 'deconz' ;;
        *nrf52840*|*zboss*)
            printf 'zboss' ;;
        *)
            printf '' ;;
    esac
}

is_known_brand() {
    case "$1" in
        *sonoff*|*itead*|*zbdongle*|*smlight*|*slzb*|*conbee*|*dresden*|\
        *skyconnect*|*nabu*|*zbt-1*|*zigstar*|*zig-star*) return 0 ;;
        *) return 1 ;;
    esac
}

prop() { printf '%s' "${1}" | sed -n "s/^${2}=//p" | head -n1; }

declare -a FOUND_SERIAL=() FOUND_MODEL=() FOUND_VENDOR=() FOUND_NODE=() \
           FOUND_ADAPTER=() FOUND_KNOWN=()

shopt -s nullglob
for link in /dev/serial/by-id/*; do
    node="$(readlink -f "$link")"
    [ -c "$node" ] || continue

    info="$(udevadm info -q property -n "$node" 2>/dev/null || true)"
    [ -n "$info" ] || continue

    serial="$(prop "$info" ID_SERIAL_SHORT)"
    vendor="$(prop "$info" ID_VENDOR)"
    model="$(prop "$info" ID_MODEL)"
    [ -n "$serial" ] || continue

    ident="$(printf '%s %s' "$vendor" "$model" | tr '[:upper:]' '[:lower:]')"

    FOUND_SERIAL+=("$serial")
    FOUND_VENDOR+=("$vendor")
    FOUND_MODEL+=("$model")
    FOUND_NODE+=("$node")
    FOUND_ADAPTER+=("$(adapter_for "$ident")")
    if is_known_brand "$ident"; then FOUND_KNOWN+=("yes"); else FOUND_KNOWN+=("no"); fi
done
shopt -u nullglob

mapped_role() {
    [ -r "$CONF" ] || return 0
    sed -e 's/#.*//' -e 's/[[:space:]]//g' "$CONF" 2>/dev/null |
        awk -F= -v s="$1" '$1 == s && $2 != "" { print $2; exit }'
}

# ---------------------------------------------------------------------------
# Persist a mapping for a single unmapped, recognised coordinator.
#
# Only when exactly one qualifies. With two unmapped dongles the assignment
# would be arbitrary, so we leave it to the operator and say which serials to
# choose between — an arbitrary choice that silently sticks is worse than a
# question.
# ---------------------------------------------------------------------------
unmapped_known=()
for i in "${!FOUND_SERIAL[@]}"; do
    [ "${FOUND_KNOWN[$i]}" = "yes" ] || continue
    [ -z "$(mapped_role "${FOUND_SERIAL[$i]}")" ] || continue
    unmapped_known+=("$i")
done

zigbee_taken=""
for i in "${!FOUND_SERIAL[@]}"; do
    [ "$(mapped_role "${FOUND_SERIAL[$i]}")" = "zigbee" ] && zigbee_taken="yes"
done

if [ "${#unmapped_known[@]}" -eq 1 ] && [ -z "$zigbee_taken" ]; then
    i="${unmapped_known[0]}"
    mkdir -p "$(dirname "$CONF")"
    [ -f "$CONF" ] || printf '# serial = role   (zigbee | thread | ignore)\n' > "$CONF"
    printf '%s = zigbee\n' "${FOUND_SERIAL[$i]}" >> "$CONF"
    log "mapped ${FOUND_MODEL[$i]} (${FOUND_SERIAL[$i]}) -> zigbee in $CONF"
    udevadm control --reload >/dev/null 2>&1 || true
    udevadm trigger --subsystem-match=tty >/dev/null 2>&1 || true
    udevadm settle --timeout=5 >/dev/null 2>&1 || true
elif [ "${#unmapped_known[@]}" -gt 1 ]; then
    log "note: ${#unmapped_known[@]} recognised coordinators are unmapped; assign roles in $CONF:"
    for i in "${unmapped_known[@]}"; do
        log "        ${FOUND_SERIAL[$i]} = zigbee|thread    # ${FOUND_MODEL[$i]}"
    done
fi

# ---------------------------------------------------------------------------
# Emit the inventory.
# ---------------------------------------------------------------------------
ZIGBEE_PORT=""; ZIGBEE_MODEL=""; ZIGBEE_SERIAL=""; ZIGBEE_ADAPTER=""
THREAD_PORT="";  THREAD_MODEL="";  THREAD_SERIAL=""

for i in "${!FOUND_SERIAL[@]}"; do
    case "$(mapped_role "${FOUND_SERIAL[$i]}")" in
        zigbee)
            ZIGBEE_MODEL="${FOUND_MODEL[$i]}"
            ZIGBEE_SERIAL="${FOUND_SERIAL[$i]}"
            ZIGBEE_ADAPTER="${FOUND_ADAPTER[$i]}"
            [ -e /dev/zigbee ] && ZIGBEE_PORT="/dev/zigbee" || ZIGBEE_PORT="${FOUND_NODE[$i]}"
            ;;
        thread)
            THREAD_MODEL="${FOUND_MODEL[$i]}"
            THREAD_SERIAL="${FOUND_SERIAL[$i]}"
            [ -e /dev/thread ] && THREAD_PORT="/dev/thread" || THREAD_PORT="${FOUND_NODE[$i]}"
            ;;
    esac
done

mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" <<EOF
# Generated by detect-radios.sh — do not edit by hand.
# Change role assignments in $CONF, then re-run this script.
#
# Ports are the udev role symlinks, which are stable across reboots, replugs
# and USB port changes. Do not substitute /dev/ttyUSB* here.
ZIGBEE_PORT=$ZIGBEE_PORT
ZIGBEE_MODEL=$ZIGBEE_MODEL
ZIGBEE_SERIAL=$ZIGBEE_SERIAL
ZIGBEE_ADAPTER=$ZIGBEE_ADAPTER
THREAD_PORT=$THREAD_PORT
THREAD_MODEL=$THREAD_MODEL
THREAD_SERIAL=$THREAD_SERIAL
EOF

# ---------------------------------------------------------------------------
# Report.
# ---------------------------------------------------------------------------
if [ "${#FOUND_SERIAL[@]}" -eq 0 ]; then
    log "no USB serial devices found — if a coordinator is plugged in, check 'lsusb' and dmesg"
fi

for i in "${!FOUND_SERIAL[@]}"; do
    role="$(mapped_role "${FOUND_SERIAL[$i]}")"
    log "  ${FOUND_MODEL[$i]:-unknown} [${FOUND_SERIAL[$i]}] -> ${FOUND_NODE[$i]}${role:+  role=$role}${FOUND_ADAPTER[$i]:+  adapter=${FOUND_ADAPTER[$i]}}"
    if [ "${FOUND_KNOWN[$i]}" = "no" ] && [ -z "$role" ]; then
        log "      not recognised as a coordinator. If it is one, add to $CONF:"
        log "        ${FOUND_SERIAL[$i]} = zigbee"
    fi
    if [ -n "$role" ] && [ -z "${FOUND_ADAPTER[$i]}" ]; then
        log "      adapter type could not be determined from the USB descriptor;"
        log "      set it explicitly in the Zigbee2MQTT configuration"
    fi
done

log "wrote $ENV_FILE"
