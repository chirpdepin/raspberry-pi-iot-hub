import type { Concentrator } from '../../domain/gateway';

/**
 * Reads the concentrator the installer scripts already detected.
 *
 * Contract 1 (S): detection only. Registering and provisioning are separate use
 * cases because they fail independently — and a user may legitimately do only
 * the third, uploading certificates for a gateway registered elsewhere.
 */

export interface ConcentratorPort {
  read(): Promise<Concentrator | null>;
}

export interface GatewayDetectPorts {
  concentrator: ConcentratorPort;
}
