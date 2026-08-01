import { domainError, err, ok, type Result } from '../../domain/errors';
import { chirpDeviceTopicTemplate, proposeMappings, type SensorMapping } from '../../domain/zigbee';

import type { LinkChirpInput, ZigbeeLinkChirpPorts } from './contract';

/**
 * Links a paired Zigbee device to Chirp.
 *
 * `client_device_id` is the **IEEE address**, never the display name. The IEEE
 * address is the Zigbee2MQTT topic and is stable forever; a display name is
 * editable, and provisioning against it would break the moment someone renamed
 * the device.
 */
export const handleZigbeeLinkChirp = async (
  ports: ZigbeeLinkChirpPorts,
  input: LinkChirpInput
): Promise<Result<void>> => {
  const connection = await ports.chirp.ensureConnection(input.hubName);
  if (!connection.ok) return err(connection.error);

  let mappings: SensorMapping[] = input.mappings ?? [];

  if (mappings.length === 0) {
    const payload = await ports.payloads.lastPayload(input.ieeeAddress);

    if (!payload) {
      // Without a message we cannot know what the device reports. Saying so is
      // far more useful than provisioning a device with no sensors and leaving
      // the user wondering why Chirp shows nothing.
      return err(
        domainError('unknown', 'This device has not sent any data yet. Wait for it to report, then add it to Chirp.')
      );
    }

    mappings = proposeMappings(payload);
  }

  const selected = mappings.filter((mapping) => mapping.selected);
  const topicTemplate = chirpDeviceTopicTemplate(input.gatewayEui);

  const provisioned = await ports.chirp.provisionDevice({
    name: input.displayName,
    connectionId: connection.value,
    clientDeviceId: input.ieeeAddress,
    deviceIdTopic: topicTemplate,
    telemetryTopics: [{ topicTemplate, connectorKey: 'state' }],
    sensorMappings: selected.map(({ sourcePath, label, unit }) => ({ sourcePath, label, unit })),
  });

  if (!provisioned.ok) return err(provisioned.error);

  return ok(undefined);
};
