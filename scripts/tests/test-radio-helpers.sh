#!/bin/bash
#
# test-radio-helpers.sh — regression tests for the role lookup and the
# create-if-absent configuration helper.
#
#     ./scripts/tests/test-radio-helpers.sh
#
# Runs off the device. The helpers require root because they chown into the
# iot-hub group, so the file-creating tests re-exec themselves inside a user
# namespace (unshare -r) where the caller is uid 0 — real root semantics against
# a throwaway tree, no sudo, nothing outside the temp directory touched.
#
# What these exist to catch, specifically:
#
#   - a brand-recognition fallback creeping back into the role lookup, which
#     would let /dev/zigbee appear for a radio nobody assigned;
#   - the configuration helper replacing an existing file, which does not lose a
#     setting, it loses the Zigbee network and every pairing in the home;
#   - a concurrent caller's write being swept, truncated or interleaved.

set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFS="$REPO_DIR/scripts/lib/iot-hub-definitions.sh"
ROLE_CMD="$REPO_DIR/scripts/iot-hub-radio-role"
ASSIGN_CMD="$REPO_DIR/scripts/iot-hub-radio-assign"
CREATE_CMD="$REPO_DIR/scripts/iot-hub-zigbee-config-create"

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; [ $# -gt 1 ] && printf '       %s\n' "$2"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected [$3], got [$2]"; fi; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The user-namespace re-exec below runs only the sections that need root, so the
# lookup and argument tests are not reported twice.
CREATE_ONLY=0
[ "${1:-}" = "--create-only" ] && CREATE_ONLY=1

if [ "$CREATE_ONLY" -eq 0 ]; then

# ---------------------------------------------------------------------------
echo "iot-hub-radio-role — pure lookup"
# ---------------------------------------------------------------------------
CONF="$TMP/radios.conf"
cat > "$CONF" <<'EOF'
# serial = role
aaaa111 = zigbee
bbbb222 = thread
cccc333 = ignore
EOF

role() { IOT_HUB_DEFINITIONS="$DEFS" IOT_HUB_RADIOS_CONF="$CONF" "$ROLE_CMD" "$@"; }

check "an assigned serial resolves to its role"      "$(role aaaa111)" "zigbee"
check "the thread role resolves too"                 "$(role bbbb222)" "thread"
check "'ignore' resolves to nothing"                 "$(role cccc333)" ""
check "an unmapped serial resolves to nothing"       "$(role dddd444)" ""
check "no serial argument resolves to nothing"       "$(role)"         ""

# The regression that matters. These descriptors used to be enough on their own:
# an unmapped SONOFF or SMLIGHT dongle was claimed as Zigbee from the USB
# descriptor, so a role symlink could exist with no entry behind it.
check "a recognised brand is NOT claimed without an entry" \
      "$(role eeee555 'ITead' 'SONOFF Zigbee 3.0 USB Dongle Plus')" ""

MISSING="$TMP/nonexistent.conf"
check "a missing map resolves to nothing" \
      "$(IOT_HUB_DEFINITIONS="$DEFS" IOT_HUB_RADIOS_CONF="$MISSING" "$ROLE_CMD" aaaa111)" ""

# ---------------------------------------------------------------------------
echo "iot-hub-radio-assign — argument handling"
# ---------------------------------------------------------------------------
IOT_HUB_DEFINITIONS="$DEFS" "$ASSIGN_CMD" aaaa111 lorawan >/dev/null 2>&1
check "an unknown role is refused"    "$?" "2"

IOT_HUB_DEFINITIONS="$DEFS" "$ASSIGN_CMD" "" zigbee >/dev/null 2>&1
check "an empty serial is refused"    "$?" "2"

IOT_HUB_DEFINITIONS="$DEFS" "$ASSIGN_CMD" >/dev/null 2>&1
check "no arguments is refused"       "$?" "2"

fi  # CREATE_ONLY

# ---------------------------------------------------------------------------
# The configuration helper needs root. Re-exec into a user namespace once and
# run the rest of the suite there.
# ---------------------------------------------------------------------------
if [ "${IOT_HUB_TEST_IN_NS:-0}" != "1" ]; then
    if [ "$(id -u)" -ne 0 ] && command -v unshare >/dev/null; then
        echo "iot-hub-zigbee-config-create — re-running in a user namespace"
        IOT_HUB_TEST_IN_NS=1 unshare -r "$0" --create-only
        ns_status=$?
        if [ "$fail" -eq 0 ] && [ "$ns_status" -eq 0 ]; then
            printf '\n%d passed\n' "$pass"; exit 0
        fi
        printf '\n%d passed, %d failed here\n' "$pass" "$fail"; exit 1
    fi
fi

# ---------------------------------------------------------------------------
echo "iot-hub-zigbee-config-create — create once, never replace"
# ---------------------------------------------------------------------------
ZDIR="$TMP/zigbee"
ZCFG="$ZDIR/configuration.yaml"

# gid 0 is the one group that exists inside a fresh user namespace.
create() {
    IOT_HUB_DEFINITIONS="$DEFS" \
    IOT_HUB_ZIGBEE_DIR="$ZDIR" \
    IOT_HUB_ZIGBEE_CONFIG="$ZCFG" \
    IOT_HUB_GROUP="$(id -gn)" \
        "$CREATE_CMD"
}

out="$(printf 'mqtt:\n  server: mqtt://127.0.0.1:1883\n' | create 2>&1)"
check "a first write is created"   "$(printf '%s' "$out" | sed -n 's/^status=//p')" "created"
check "the content is the content" "$(sed -n '2p' "$ZCFG")" "  server: mqtt://127.0.0.1:1883"
check "the mode is the contract"   "$(stat -c '%a' "$ZCFG")" "640"
check "the directory is setgid"    "$(stat -c '%a' "$ZDIR")" "2750"

out="$(printf 'mqtt:\n  server: SOMETHING ELSE\n' | create 2>&1)"
check "a second write reports exists" "$(printf '%s' "$out" | sed -n 's/^status=//p')" "exists"
check "and does NOT replace the file" "$(sed -n '2p' "$ZCFG")" "  server: mqtt://127.0.0.1:1883"

check "a destination argument is refused" \
      "$(printf 'x\n' | IOT_HUB_DEFINITIONS="$DEFS" IOT_HUB_ZIGBEE_CONFIG="$ZCFG" \
         "$CREATE_CMD" /tmp/somewhere-else.yaml >/dev/null 2>&1; echo $?)" "2"

check "no staging file is left behind" \
      "$(find "$ZDIR" -name '.configuration.yaml.*' | wc -l)" "0"

# ---------------------------------------------------------------------------
echo "iot-hub-zigbee-config-create — concurrent callers"
# ---------------------------------------------------------------------------
CDIR="$TMP/concurrent"
CCFG="$CDIR/configuration.yaml"

# A long body, so a torn write shows up as content that differs rather than
# needing luck to catch. Compared against the exact bytes, not a line count —
# a count is an assertion about arithmetic, and it is the test that gets it
# wrong first.
BODY="$(for n in $(seq 1 400); do printf 'line-%03d: value\n' "$n"; done)"
printf '%s\n' "$BODY" > "$TMP/expected.yaml"

for i in $(seq 1 20); do
    printf '%s\n' "$BODY" | \
    IOT_HUB_DEFINITIONS="$DEFS" \
    IOT_HUB_ZIGBEE_DIR="$CDIR" \
    IOT_HUB_ZIGBEE_CONFIG="$CCFG" \
    IOT_HUB_GROUP="$(id -gn)" \
        "$CREATE_CMD" > "$TMP/out.$i" 2>&1 &
done
wait

created="$(grep -lh 'status=created' "$TMP"/out.* 2>/dev/null | wc -l)"
exists="$(grep -lh 'status=exists' "$TMP"/out.* 2>/dev/null | wc -l)"

check "exactly one caller created it"       "$created" "1"
check "the other nineteen saw it exists"    "$exists"  "19"
check "the survivor is byte-for-byte one document" \
      "$(cmp -s "$CCFG" "$TMP/expected.yaml" && echo same || echo differs)" "same"
check "no staging files survived the race"  "$(find "$CDIR" -name '.configuration.yaml.*' | wc -l)" "0"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
