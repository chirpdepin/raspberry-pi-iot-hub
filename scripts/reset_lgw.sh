#!/bin/sh
#
# Compatibility shim for sx1302_hal.
#
# chip_id and the HAL test tools shell out to "./reset_lgw.sh" in their working
# directory. Upstream's copy of that script drives the reset line through the
# sysfs GPIO ABI (/sys/class/gpio), which no longer exists on Ubuntu 26.04 /
# kernel 7.x — it fails with "Directory nonexistent" and the concentrator then
# never answers on SPI, which looks like a dead card.
#
# Redirect to the GPIO character device helper instead.
exec /usr/local/bin/concentrator-reset "${1:-start}"
