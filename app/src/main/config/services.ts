/**
 * systemd unit names, matching the files installed by `scripts/install-*.sh`.
 *
 * Contract 4: one source of truth. These were declared separately inside the
 * LoRaWAN use case and the Zigbee adapter, so a unit renamed in the installer
 * had to be found in two unrelated files — and the app fails silently when it
 * asks systemd about a unit that no longer exists.
 *
 * Ubuntu Core note (Contract 3): these become snap daemon names — `snap
 * services chirp-hub.lorawan` rather than `systemctl is-active
 * iot-hub-lorawan`. Keeping them in one table means that migration edits this
 * file and the service-state adapter, not every subsystem.
 */
export const SERVICES = {
  /** Basic Station, host networking, outbound to the LNS. */
  lorawan: 'iot-hub-lorawan',
  /** Mosquitto. Started as a dependency of Zigbee2MQTT, not on its own. */
  mqtt: 'iot-hub-mqtt',
  /** Zigbee2MQTT. Requires the MQTT broker. */
  zigbee: 'iot-hub-zigbee',
  /** OpenThread border router. */
  thread: 'iot-hub-thread',
} as const;

export type ServiceName = (typeof SERVICES)[keyof typeof SERVICES];

/**
 * The container each unit actually manages.
 *
 * Needed because the units are `Type=oneshot` with `RemainAfterExit=yes` around
 * `docker compose up -d`: systemd reports the unit active once that command has
 * returned, and keeps reporting it active even after the container has died.
 * Asking systemd alone would show a dead stack as running, which is the failure
 * a health probe exists to catch.
 */
export const SERVICE_CONTAINERS: Record<ServiceName, string> = {
  'iot-hub-lorawan': 'basicstation',
  'iot-hub-mqtt': 'mosquitto',
  'iot-hub-zigbee': 'zigbee2mqtt',
  'iot-hub-thread': 'otbr',
};
