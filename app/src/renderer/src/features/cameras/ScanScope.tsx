import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ScannedNetworkPayload } from '@shared/ipc';

import { LAYOUT } from '../../config/defaults';

interface ScanScopeProps {
  networks: ScannedNetworkPayload[];
}

/**
 * What the scan actually looked at, and why a camera might not be in the list.
 *
 * **This exists to stop a working scan looking like a broken app.** Someone with
 * twenty cameras who scans and sees one has no way to tell a partial result from
 * a failure — and discovery is partial by nature: it only finds cameras that
 * advertise themselves over ONVIF, which is switched off by default on a great
 * many models, and it cannot reach a camera on another network at all.
 *
 * The concrete number is what does the work. "Searched 254 addresses on
 * 192.168.2.0/24" is checkable, and it makes a camera on another subnet obvious
 * immediately, in a way "some cameras can't be found" never would.
 *
 * Contract 2 rule 1: no "ONVIF" and no "subnet" in the sentence the user reads —
 * "advertise themselves" is what it means to someone who has never heard the
 * word, and the term belongs behind [Technical details].
 */
export const ScanScope = memo<ScanScopeProps>(({ networks }) => {
  const { t } = useTranslation();

  const searched = networks.filter((network) => !network.skipped);
  const tooLarge = networks.filter((network) => network.skipped === 'too-large');

  return (
    <Stack sx={{ gap: LAYOUT.gapSm }}>
      {searched.map((network) => (
        <Typography key={network.cidr} variant='caption' sx={(theme) => ({ color: theme.palette.text.secondary })}>
          {t('Searched {{count}} addresses on {{network}}.', { count: network.hosts, network: network.cidr })}
        </Typography>
      ))}

      {/* A network we declined to sweep is a fact the user needs, not an error:
          sweeping 65,534 addresses would be an attack on their own machine. */}
      {tooLarge.map((network) => (
        <Typography key={network.cidr} variant='caption' sx={(theme) => ({ color: theme.palette.warning.main })}>
          {t('Your network {{network}} is too large to search ({{count}} addresses), so only cameras that answered a general call are listed.', {
            count: network.hosts,
            network: network.cidr,
          })}
        </Typography>
      ))}

      <Typography variant='caption' sx={(theme) => ({ color: theme.palette.text.secondary })}>
        {t(
          "Only cameras that advertise themselves can be found this way, and many don't — it's usually switched off in the camera's own settings. Cameras on a different network won't appear either. Use Add camera for any camera that isn't listed."
        )}
      </Typography>
    </Stack>
  );
});
