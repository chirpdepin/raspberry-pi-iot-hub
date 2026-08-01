import { describe, expect, it } from 'vitest';

import { handleGatewayDetect } from './usecase';

describe('gateway-detect', () => {
  it('returns the concentrator when one is fitted', async () => {
    const concentrator = {
      eui: '0016C001FF1E96BB',
      model: 'RAK5146',
      interface: 'SPI',
      devicePath: '/dev/spidev0.0',
    };

    const result = await handleGatewayDetect({ concentrator: { read: async () => concentrator } });

    expect(result).toEqual(concentrator);
  });

  it('returns null rather than throwing when there is no radio', async () => {
    // A laptop has no concentrator. That is the normal case, not a failure, and
    // the UI must be able to render an explanation rather than an error.
    const result = await handleGatewayDetect({ concentrator: { read: async () => null } });

    expect(result).toBeNull();
  });
});
