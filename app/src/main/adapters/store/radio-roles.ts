import Store from 'electron-store';

import type { RadioRole } from '../../domain/radio';
import type { RadioRolePort } from '../../usecase/radio-roles/contract';

/**
 * Radio roles, pinned per USB serial.
 *
 * The Pi keeps this mapping in `/etc/iot-hub/radios.conf` so its udev rules can
 * create `/dev/zigbee`; a machine with no such rules keeps the same mapping
 * here. Keyed on the USB serial in both cases, so a role follows the physical
 * dongle across ports and reboots rather than following a device node that
 * changes with enumeration order.
 */

interface RadioRolesSchema {
  roles: Record<string, RadioRole>;
}

export const createRadioRoleStore = (): RadioRolePort => {
  const store = new Store<RadioRolesSchema>({ name: 'radio-roles', defaults: { roles: {} } });

  return {
    async roles(): Promise<Record<string, RadioRole>> {
      return store.get('roles');
    },

    async assign(serial: string, role: RadioRole): Promise<void> {
      store.set('roles', { ...store.get('roles'), [serial]: role });
    },
  };
};
