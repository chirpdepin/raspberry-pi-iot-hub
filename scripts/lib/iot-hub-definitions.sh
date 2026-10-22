# iot-hub-definitions.sh — the authoritative names, paths, modes and timeouts.
#
# Installed to /usr/local/lib/iot-hub/definitions.sh and sourced by every hub
# script and by the onboarding app's privileged helpers. Nothing below is
# restated anywhere else: a path spelled twice is a path that will disagree with
# itself after the first change.
#
# POSIX sh — sourced by both /bin/sh and bash callers, so no bashisms.
#
# Every value may be overridden from the environment, which is what makes these
# scripts testable off the device. Defaults only.

: "${IOT_HUB_ETC_DIR:=/etc/iot-hub}"
: "${IOT_HUB_OPT_DIR:=/opt/iot-hub}"
: "${IOT_HUB_VAR_DIR:=/var/lib/iot-hub}"

# Radio inventory and role map.
: "${IOT_HUB_RADIOS_CONF:=$IOT_HUB_ETC_DIR/radios.conf}"
: "${IOT_HUB_RADIOS_ENV:=$IOT_HUB_ETC_DIR/radios.env}"

# Zigbee2MQTT. The directory is bind-mounted into the container as /app/data,
# so it holds the network key, the device database and the coordinator backup —
# not just the configuration file.
: "${IOT_HUB_ZIGBEE_DIR:=$IOT_HUB_ETC_DIR/zigbee}"
: "${IOT_HUB_ZIGBEE_CONFIG:=$IOT_HUB_ZIGBEE_DIR/configuration.yaml}"
: "${IOT_HUB_ZIGBEE_TEMPLATE:=$IOT_HUB_ETC_DIR/zigbee-configuration.yaml.template}"

# Ownership contract.
#
# The onboarding app must be able to READ the Zigbee configuration — it cannot
# check whether an existing network is compatible with what the user is asking
# for otherwise — while never being able to REPLACE it. A file only the app's
# own user could read would fail its own compatibility check on the second run;
# a file the app could write would let a bug destroy a live Zigbee network.
#
# So: root owns it, group iot-hub reads it, and only the privileged helper
# creates it. Zigbee2MQTT rewrites it as container root, which is unaffected.
#
# The directory is setgid so that everything Zigbee2MQTT creates inside it —
# database.db, coordinator_backup.json — also lands in the iot-hub group and
# stays readable by the app.
: "${IOT_HUB_GROUP:=iot-hub}"
: "${IOT_HUB_DIR_MODE:=2750}"
: "${IOT_HUB_CONFIG_MODE:=0640}"

# One writer for the role map. Assignment parses, rewrites, refreshes udev and
# verifies as a single operation; a concurrent second assignment would otherwise
# read the map between the first one's read and write.
: "${IOT_HUB_RADIOS_LOCK:=/run/lock/iot-hub-radios.lock}"

# udev has to enumerate the device, run the role helper and create the symlink
# before an assignment can be verified. Ten seconds is generous for a USB serial
# device; the failure it guards against is a hang, not a slow bus.
: "${IOT_HUB_UDEV_TIMEOUT:=10}"

# Helper names, so a caller never hardcodes a path we might move.
: "${IOT_HUB_BIN_DIR:=/usr/local/bin}"
: "${IOT_HUB_RADIO_ROLE_CMD:=$IOT_HUB_BIN_DIR/iot-hub-radio-role}"
: "${IOT_HUB_RADIO_ASSIGN_CMD:=$IOT_HUB_BIN_DIR/iot-hub-radio-assign}"
: "${IOT_HUB_DETECT_RADIOS_CMD:=$IOT_HUB_BIN_DIR/detect-radios.sh}"
: "${IOT_HUB_ZIGBEE_CONFIG_CREATE_CMD:=$IOT_HUB_BIN_DIR/iot-hub-zigbee-config-create}"
