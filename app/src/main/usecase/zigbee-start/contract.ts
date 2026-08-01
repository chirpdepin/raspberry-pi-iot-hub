import type { Result } from '../../domain/errors';
import type { ZigbeeCoordinator } from '../../domain/zigbee';

export interface ZigbeeServicePort {
  coordinator(): Promise<ZigbeeCoordinator | null>;
  isRunning(): Promise<boolean>;
  /** Renders configuration.yaml and starts the broker plus Zigbee2MQTT. */
  start(input: { channel: number; port: string; adapter: string }): Promise<Result<void>>;
}

export interface ZigbeeStartPorts {
  service: ZigbeeServicePort;
}
