import type { Capabilities, Host } from '../../domain/host';

/**
 * Ports this use case needs.
 *
 * Contract 1 (D): declared HERE, by the consumer, and implemented in
 * `adapters/`. The use case never names a concrete class, which is what makes
 * the test below runnable with no Docker, no radio and no Electron.
 *
 * Contract 1 (I): three narrow ports rather than one `SystemPort`. They fail
 * independently in real life — a machine can have Docker but no radio, or a
 * radio but a stopped Docker — and the UI has to distinguish those cases.
 */

export interface HostInfoPort {
  read(): Promise<Host>;
}

export interface ContainerRuntimePort {
  /** Whether a container runtime is installed and its daemon is reachable. */
  status(): Promise<{ installed: boolean; running: boolean; version: string | null }>;
}

export interface RadioDiscoveryPort {
  /** True when a LoRaWAN concentrator is fitted and answering. */
  hasConcentrator(): Promise<boolean>;
  /** True when a supported Zigbee coordinator is attached. */
  hasZigbeeCoordinator(): Promise<boolean>;
  /** True when a second radio is present and mapped to the Thread role. */
  hasThreadRadio(): Promise<boolean>;
}

export interface HostCapabilitiesPorts {
  hostInfo: HostInfoPort;
  containerRuntime: ContainerRuntimePort;
  radios: RadioDiscoveryPort;
}

export interface HostCapabilitiesResult {
  host: Host;
  capabilities: Capabilities;
}
