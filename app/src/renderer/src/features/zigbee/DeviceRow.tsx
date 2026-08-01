import { Button, Card } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ZigbeeDeviceInfo } from '@shared/ipc';

import { DeviceStatusDots } from './DeviceStatusDots';

interface DeviceRowProps {
  device: ZigbeeDeviceInfo;
  onLink: (ieeeAddress: string, displayName: string) => void;
}

/** Signal strength in words. 255 is the maximum LQI; the bands are the usual ones. */
const signalLabel = (linkQuality: number | null): string => {
  if (linkQuality === null) return 'Unknown';
  if (linkQuality >= 150) return 'Good';
  if (linkQuality >= 80) return 'Fair';
  return 'Weak';
};

export const DeviceRow = memo<DeviceRowProps>(({ device, onLink }) => {
  const { t } = useTranslation();

  const handleLink = () => onLink(device.ieeeAddress, device.displayName);

  return (
    <Card>
      <Stack sx={{ gap: '8px', padding: '8px' }}>
        <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <Stack sx={{ gap: '2px' }}>
            <Typography variant='body1'>{device.displayName}</Typography>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {[device.manufacturer, device.model].filter(Boolean).join(' ') || device.type}
            </Typography>
          </Stack>

          {device.connectedToChirp ? null : (
            <Button variant='primary' size='small' onClick={handleLink}>
              {t('Add to Chirp')}
            </Button>
          )}
        </Stack>

        <DeviceStatusDots connectedToHub={device.connectedToHub} connectedToChirp={device.connectedToChirp} />

        <Stack direction='row' sx={{ gap: '16px', flexWrap: 'wrap' }}>
          <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
            {t('Signal')}: {t(signalLabel(device.linkQuality))}
          </Typography>

          {device.batteryPercent === null ? null : (
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t('Battery')}: {device.batteryPercent}%
            </Typography>
          )}
        </Stack>
      </Stack>
    </Card>
  );
});
