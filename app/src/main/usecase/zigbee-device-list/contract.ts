import type { ZigbeeCoordinator, ZigbeeDevice } from '../../domain/zigbee';

/**
 * Contract 1 (I): two separate ports, deliberately.
 *
 * `Zigbee2MqttPort` is the local radio; `ChirpDevicePort` is the cloud. The
 * entire troubleshooting story depends on knowing WHICH of the two failed —
 * "is it my device or your cloud?" — and that is only answerable if they are
 * distinct ports that can fail independently.
 */

export interface Zigbee2MqttPort {
  coordinator(): Promise<ZigbeeCoordinator | null>;
  /** Devices known to the local Zigbee network. */
  devices(): Promise<Omit<ZigbeeDevice, 'connectedToChirp'>[]>;
  /** True when the local broker and Zigbee2MQTT are both reachable. */
  isRunning(): Promise<boolean>;
}

export interface ChirpDevicePort {
  /** IEEE addresses already provisioned in Chirp. */
  provisionedIds(): Promise<string[]>;
}

export interface ZigbeeDeviceListPorts {
  zigbee: Zigbee2MqttPort;
  chirp: ChirpDevicePort;
}
