import { Card } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppInfo, DockerStatus, HostDetails, SystemLoadPayload } from '@shared/ipc';

import { LAYOUT } from '../../config/defaults';
import { MeterBar } from '../common/MeterBar';

interface DeviceCardProps {
  host?: HostDetails['host'];
  appInfo?: AppInfo;
  docker?: DockerStatus;
  load?: SystemLoadPayload;
}

const GIB = 1024 ** 3;
const PERCENT = 100;

/** Bytes to a whole number of GB — the only precision a user needs here. */
const formatMemory = (bytes: number): string => `${Math.round(bytes / GIB)} GB`;

/**
 * What this machine is, and how hard it is currently working.
 *
 * The live rows sit here rather than on a card of their own so every fact about
 * the device stays in one place. They refresh on their own timer, which is the
 * point: adding a camera visibly moves the load, turning "this hardware has
 * limits" from a claim into something the user can watch happen.
 *
 * Shown on **every** machine, unlike the camera limit — a desktop has load worth
 * seeing too. This component formats and colors; it computes no percentages and
 * owns no thresholds, both of which are decided in the `system-load` use case.
 */
export const DeviceCard = memo<DeviceCardProps>(({ host, appInfo, docker, load }) => {
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

  const meters = load
    ? [
        {
          label: 'Processor load',
          value: `${load.loadPercent}%`,
          // Both the percentage and the raw load average: the percentage is what
          // a non-technical user reads, the raw figure is what anyone comparing
          // against `uptime` on the hub needs to see the same number.
          detail: `${t('load')} ${load.load1.toFixed(2)} ${t('of')} ${load.cpuCount}`,
          fraction: load.loadPercent / PERCENT,
        },
        {
          label: 'Memory used',
          value: `${load.memoryPercent}%`,
          detail: `${formatMemory(load.usedMemoryBytes)} ${t('of')} ${formatMemory(load.totalMemoryBytes)}`,
          fraction: load.memoryPercent / PERCENT,
        },
      ]
    : [];

  return (
    <Card sx={{ height: '100%' }}>
      <Stack sx={{ gap: LAYOUT.gapLg, padding: LAYOUT.gapSm }}>
        <Typography variant='h6'>{t('This device')}</Typography>

        {rows.map((row) => (
          <Stack key={row.label} direction='row' sx={{ justifyContent: 'space-between', gap: LAYOUT.gapXxl }}>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t(row.label)}
            </Typography>
            <Typography variant='body2'>{row.value}</Typography>
          </Stack>
        ))}

        {meters.map((meter) => (
          <Stack key={meter.label} sx={{ gap: LAYOUT.gapSm }}>
            <Stack direction='row' sx={{ justifyContent: 'space-between', gap: LAYOUT.gapXxl }}>
              <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
                {t(meter.label)}
              </Typography>
              <Typography variant='body2'>{meter.value}</Typography>
            </Stack>

            <MeterBar fraction={meter.fraction} strained={load?.strain === 'high'} />

            <Typography variant='caption' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {meter.detail}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
});
