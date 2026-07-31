import { Card } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppInfo, DockerStatus, HostDetails } from '@shared/ipc';

interface DeviceCardProps {
  host?: HostDetails['host'];
  appInfo?: AppInfo;
  docker?: DockerStatus;
}

const GIB = 1024 ** 3;

/** Bytes to a whole number of GB — the only precision a user needs here. */
const formatMemory = (bytes: number): string => `${Math.round(bytes / GIB)} GB`;

export const DeviceCard = memo<DeviceCardProps>(({ host, appInfo, docker }) => {
  const { t } = useTranslation();

  if (!host) return null;

  const rows: { label: string; value: string }[] = [
    { label: 'Device', value: host.hostname },
    { label: 'System', value: `${host.platform} (${host.arch})` },
    { label: 'Memory', value: formatMemory(host.totalMemoryBytes) },
    { label: 'Processors', value: String(host.cpuCount) },
    {
      label: 'Docker',
      // Three distinct states, because the action differs for each.
      value: !docker?.installed
        ? t('Not installed')
        : docker.running
          ? (docker.version ?? t('Running'))
          : t('Not running'),
    },
    { label: 'App version', value: appInfo?.version ?? '—' },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <Stack sx={{ gap: '8px', padding: '4px' }}>
        <Typography variant='h6'>{t('This device')}</Typography>

        {rows.map((row) => (
          <Stack key={row.label} direction='row' sx={{ justifyContent: 'space-between', gap: '16px' }}>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t(row.label)}
            </Typography>
            <Typography variant='body2'>{row.value}</Typography>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
});
