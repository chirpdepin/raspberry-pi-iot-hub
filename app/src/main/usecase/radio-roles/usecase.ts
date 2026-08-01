import type { RadioRolesPorts, RadioRolesResult } from './contract';

/**
 * Works out which attached radio plays which role.
 *
 * Mirrors `scripts/detect-radios.sh` exactly, and the rule is worth stating
 * because it is deliberately conservative:
 *
 * - **exactly one** recognised coordinator with no role, and no Zigbee role
 *   already taken → claim it for Zigbee. That is the overwhelmingly common
 *   case: one dongle, one job, no question worth asking.
 * - **two or more** unclaimed → assign nothing and hand them back for the UI to
 *   ask about. One radio cannot run Zigbee and Thread at once — different
 *   firmware — so picking for the user would be picking wrong half the time,
 *   and *an arbitrary choice that silently sticks is worse than a question*.
 * - **unrecognised** hardware is never claimed. A CP2102 bridge appears on
 *   thousands of unrelated boards, so a bridge chip is not evidence of a
 *   coordinator.
 *
 * Contract 1 (S): it decides roles. It does not scan and it does not start
 * anything.
 */
export const handleRadioRoles = async (ports: RadioRolesPorts): Promise<RadioRolesResult> => {
  const [devices, pinned] = await Promise.all([ports.scan.scan(), ports.roles.roles()]);

  const recognised = devices.filter((device) => device.known);
  const unrecognised = devices.filter((device) => !device.known);

  const assigned = recognised.flatMap((device) => {
    const role = pinned[device.serial];
    return role ? [{ role, device }] : [];
  });

  const unclaimed = recognised.filter((device) => !pinned[device.serial]);
  const zigbeeTaken = assigned.some((entry) => entry.role === 'zigbee');

  // A device with no serial cannot be pinned, so claiming it would not survive
  // a replug — it goes to the UI instead.
  const claimable = unclaimed.filter((device) => device.serial.length > 0);

  const [only] = claimable;

  if (claimable.length === 1 && only && !zigbeeTaken) {
    const device = only;
    await ports.roles.assign(device.serial, 'zigbee');

    return {
      assigned: [...assigned, { role: 'zigbee', device }],
      awaitingChoice: unclaimed.filter((candidate) => candidate !== device),
      unrecognised,
    };
  }

  return { assigned, awaitingChoice: unclaimed, unrecognised };
};
