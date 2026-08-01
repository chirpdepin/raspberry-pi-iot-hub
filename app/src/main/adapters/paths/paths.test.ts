import { describe, expect, it } from 'vitest';

import { createPaths } from './paths';

/**
 * The layout is chosen by asking whether the hub image is installed, not which
 * OS this is.
 *
 * That distinction is the bug this replaced: choosing on `platform === 'linux'`
 * handed a Linux **desktop** the image's root-owned paths, so anything that
 * wrote would need root for a dongle the user can already open through
 * `dialout`.
 *
 * The Pi cannot run this suite — it is headless — so these tests are what
 * guarantee the device still gets its own paths after the change.
 */
describe('paths', () => {
  it('gives the hub image its installed layout', () => {
    const paths = createPaths(true);

    expect(paths.hubConfigDir()).toBe('/etc/iot-hub');
    expect(paths.radiosEnv()).toBe('/etc/iot-hub/radios.env');
    expect(paths.zigbeeDataDir()).toBe('/etc/iot-hub/zigbee');
    // The udev role symlink the image's rules create.
    expect(paths.radioDevice('zigbee')).toBe('/dev/zigbee');
  });

  it('keeps a plain machine out of /etc, where it has no business writing', () => {
    const paths = createPaths(false);

    for (const path of [paths.hubConfigDir(), paths.radiosEnv(), paths.zigbeeDataDir()]) {
      expect(path.startsWith('/etc/')).toBe(false);
    }
  });

  it('puts a plain machine under the user home', () => {
    expect(createPaths(false).hubConfigDir()).toContain('.chirp-hub');
  });

  it('never returns the same location for both', () => {
    // If these ever coincided, a desktop would read the image's inventory and
    // report hardware that is not attached to it.
    expect(createPaths(true).radiosEnv()).not.toBe(createPaths(false).radiosEnv());
  });
});
