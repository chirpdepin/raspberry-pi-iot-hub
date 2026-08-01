import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CapacityPayload } from '@shared/ipc';

interface CapacityBarProps {
  capacity: CapacityPayload;
}

/**
 * How many cameras this device should run.
 *
 * Advice, never a block — the numbers are an estimate until the benchmark in
 * scripts/benchmark-twins.sh has run, and refusing a camera on an unmeasured
 * guess would be worse than warning about it.
 *
 * `measured: false` is said out loud rather than hidden. Presenting an estimate
 * as a measurement turns a dropped recording into what looks like a defect.
 */
export const CapacityBar = memo<CapacityBarProps>(({ capacity }) => {
  const { t } = useTranslation();

  const fraction = Math.min(1, capacity.current / Math.max(1, capacity.recommended));

  return (
    <Stack sx={{ gap: '6px', width: '100%' }}>
      <Stack direction='row' sx={{ justifyContent: 'space-between', gap: '16px' }}>
        <Typography variant='body2'>
          {capacity.current} {t('of about')} {capacity.recommended} {t('cameras on this device')}
        </Typography>

        {capacity.measured ? null : (
          <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
            {t('estimated')}
          </Typography>
        )}
      </Stack>

      <Stack
        sx={(theme) => ({
          height: '6px',
          borderRadius: '3px',
          backgroundColor: theme.palette.action.hover,
          overflow: 'hidden',
        })}
      >
        <Stack
          sx={(theme) => ({
            height: '100%',
            width: `${fraction * 100}%`,
            backgroundColor: capacity.warning ? theme.palette.warning.main : theme.palette.success.main,
          })}
        />
      </Stack>

      {capacity.warning ? (
        <Typography variant='body2' sx={(theme) => ({ color: theme.palette.warning.main })}>
          {t(capacity.warning)}
        </Typography>
      ) : null}
    </Stack>
  );
});
