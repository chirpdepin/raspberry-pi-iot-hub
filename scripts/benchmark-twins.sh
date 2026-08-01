#!/bin/bash
#
# benchmark-twins.sh — measure how many camera Twins this hardware can run.
#
# The only published figures for a Twin are its Kubernetes manifests
# (requests 100m/128Mi, limits 1000m/512Mi), and those predate the cgo ffmpeg
# motion-detection path: every Twin does real libavcodec decoding and can spawn
# a separate go2rtc subprocess. The 100m request is almost certainly not what a
# working camera costs, so the numbers in app/src/main/config/capacity.ts are
# marked unmeasured until this script has run.
#
# Blocked on the published Twin image (Phase 7, lens-twin CI). Written now so
# the measurement is a single command once the image exists.
#
# Usage:
#   ./benchmark-twins.sh --camera rtsp://user:pass@host/path [--max 8] [--mode motion]

set -euo pipefail

CAMERA=""
MAX_TWINS=8
MODE="motion"
IMAGE="${TWIN_IMAGE:-lens-twin:latest}"
SAMPLE_SECONDS=120

while [ $# -gt 0 ]; do
    case "$1" in
        --camera) CAMERA="$2"; shift 2 ;;
        --max) MAX_TWINS="$2"; shift 2 ;;
        --mode) MODE="$2"; shift 2 ;;
        --image) IMAGE="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

[ -n "$CAMERA" ] || { echo "--camera is required" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }

RESULTS="benchmark-$(uname -m)-${MODE}.csv"
echo "twins,cpu_percent_total,mem_mb_total,load_1min" > "$RESULTS"

cleanup() {
    docker ps -a --filter 'name=bench-twin-' --format '{{.Names}}' | xargs -r docker rm -f >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Hardware: $(uname -m), $(nproc) cores, $(free -g | awk '/^Mem:/{print $2}') GB"
echo "Mode:     $MODE"
echo

for count in $(seq 1 "$MAX_TWINS"); do
    docker run -d --name "bench-twin-$count" \
        -e TWIN_CAPTURE_MOTION="$([ "$MODE" = motion ] && echo true || echo false)" \
        -e TWIN_CAPTURE_CONTINUOUS="$([ "$MODE" = continuous ] && echo true || echo false)" \
        -e TWIN_ALLOW_DEFAULT_LOCAL_CREDENTIALS=true \
        "$IMAGE" >/dev/null

    # Let the new Twin reach steady state before sampling: startup decode is not
    # representative of running cost.
    sleep 30

    read -r cpu mem < <(
        docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}}' \
            $(docker ps --filter 'name=bench-twin-' --format '{{.Names}}') \
        | awk '{gsub(/%/,"",$1); cpu+=$1; gsub(/MiB.*/,"",$2); mem+=$2} END {print cpu, mem}'
    )

    load=$(awk '{print $1}' /proc/loadavg)

    printf '%s twins: CPU %.1f%%  RAM %.0f MB  load %s\n' "$count" "$cpu" "$mem" "$load"
    printf '%s,%.1f,%.0f,%s\n' "$count" "$cpu" "$mem" "$load" >> "$RESULTS"

    # Past this the host is saturated and further samples measure queueing, not
    # capacity.
    if awk -v l="$load" -v c="$(nproc)" 'BEGIN{exit !(l > c)}'; then
        echo
        echo "Load average exceeded core count at $count twins — stopping."
        break
    fi
done

echo
echo "Wrote $RESULTS"
echo "Update CAPACITY_PROFILES in app/src/main/config/capacity.ts and set measured: true."
