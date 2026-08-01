import { Tooltip } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT } from '../../config/defaults';

interface DeviceStatusDotsProps {
  connectedToHub: boolean;
  connectedToChirp: boolean;
}

/**
 * Two independent status dots — the whole troubleshooting story in one control.
 *
 * They answer "is it my device or your cloud?" without a support ticket:
 *
 *   hub off              -> never paired, or asleep/out of range
 *   hub on, Chirp off    -> the bridge or its credentials
 *   both on, no readings -> the sensor mapping
 *
 * The labels are deliberately "Connected to hub" and "Connected to Chirp",
 * never "Zigbee" and "MQTT" — the user does not know what MQTT is, and does not
 * need to.
 */
const Dot = ({ on }: { on: boolean }) => (
  <Stack
    component='span'
    sx={(theme) => ({
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: on ? theme.palette.success.main : theme.palette.text.disabled,
    })}
  />
);

export const DeviceStatusDots = memo<DeviceStatusDotsProps>(({ connectedToHub, connectedToChirp }) => {
  const { t } = useTranslation();

  return (
    <Stack direction='row' sx={{ gap: LAYOUT.gapXxl, alignItems: 'center' }}>
      <Tooltip
        title={t(connectedToHub ? 'This device is reporting to the hub.' : 'The hub has not heard from this device.')}
      >
        <Stack direction='row' sx={{ gap: LAYOUT.gapMd, alignItems: 'center' }}>
          <Dot on={connectedToHub} />
          <Typography variant='body2'>{t('Connected to hub')}</Typography>
        </Stack>
      </Tooltip>

      <Tooltip
        title={t(connectedToChirp ? 'Readings are reaching Chirp.' : 'This device has not been added to Chirp yet.')}
      >
        <Stack direction='row' sx={{ gap: LAYOUT.gapMd, alignItems: 'center' }}>
          <Dot on={connectedToChirp} />
          <Typography variant='body2'>{t('Connected to Chirp')}</Typography>
        </Stack>
      </Tooltip>
    </Stack>
  );
});
