import type { IdentifiedSerialDevice, RadioRole } from '../../domain/radio';

/**
 * Which attached radio plays which role.
 *
 * Contract 1 (I): scanning, remembering and assigning are three concerns and
 * three ports. The scan cannot remember; the store cannot decide.
 */

export interface RadioScanPort {
  scan(): Promise<IdentifiedSerialDevice[]>;
}

/**
 * Role pinned per USB serial, so it follows the physical dongle across ports
 * and reboots. The Pi keeps this in `/etc/iot-hub/radios.conf`; elsewhere it is
 * stored per serial by the app. Same rule, two homes.
 */
export interface RadioRolePort {
  roles(): Promise<Record<string, RadioRole>>;
  assign(serial: string, role: RadioRole): Promise<void>;
}

export interface RadioRolesPorts {
  scan: RadioScanPort;
  roles: RadioRolePort;
}

export interface AssignedRadio {
  role: RadioRole;
  device: IdentifiedSerialDevice;
}

export interface RadioRolesResult {
  /** Radios with a role, ready to be used. */
  assigned: AssignedRadio[];
  /**
   * Recognised coordinators with no role, where assigning one would have been a
   * guess. The UI asks; it does not pick.
   */
  awaitingChoice: IdentifiedSerialDevice[];
  /**
   * Serial devices we do not recognise as coordinators. Still surfaced, so a
   * user with unusual hardware can see it was noticed rather than ignored.
   */
  unrecognised: IdentifiedSerialDevice[];
}
