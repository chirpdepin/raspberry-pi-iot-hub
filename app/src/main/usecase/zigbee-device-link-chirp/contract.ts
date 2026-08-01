import type { Result } from '../../domain/errors';
import type { SensorMapping } from '../../domain/zigbee';

/**
 * Provisions one Zigbee device into Chirp.
 *
 * Mirrors `device_provision_mqtt`: name, connection_id, client_device_id,
 * device_id_topic, telemetry_topics and sensor_mappings.
 */

export interface ChirpProvisionPort {
  /** Creates the mqtt_cloud connection once per hub, returning its id. */
  ensureConnection(hubName: string): Promise<Result<string>>;
  provisionDevice(input: {
    name: string;
    connectionId: string;
    clientDeviceId: string;
    deviceIdTopic: string;
    telemetryTopics: { topicTemplate: string; connectorKey: string }[];
    sensorMappings: { sourcePath: string; label: string; unit?: string }[];
  }): Promise<Result<void>>;
}

export interface ObservedPayloadPort {
  /**
   * The most recent payload seen for a device, used to propose sensor mappings
   * from what the device actually sends rather than a static database.
   */
  lastPayload(ieeeAddress: string): Promise<Record<string, unknown> | null>;
}

export interface ZigbeeLinkChirpPorts {
  chirp: ChirpProvisionPort;
  payloads: ObservedPayloadPort;
}

export interface LinkChirpInput {
  ieeeAddress: string;
  displayName: string;
  gatewayEui: string;
  hubName: string;
  /** When omitted, mappings are proposed from the observed payload. */
  mappings?: SensorMapping[];
}
