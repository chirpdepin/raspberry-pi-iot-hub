import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CapacityPayload } from '@shared/ipc';

import { LAYOUT } from '../../config/defaults';
import { MeterBar } from '../common/MeterBar';

interface CapacityBarProps {
  capacity: CapacityPayload;
}

/**
 * How many cameras this device should run.
 *
 * Shown only where the figure was measured on that hardware; the use case
 * decides that via `applies`, so this component holds no hardware rule.
 *
 * The limit is stated in full whether or not the user is near it. Someone
 * planning where to put six cameras needs the ceiling *before* camera six, and
 * a sentence that appears only once you are stuck arrives too late to be advice.
 *
 * Advice, never a block: nothing here prevents adding another camera.
 */
export const CapacityBar = memo<CapacityBarProps>(({ capacity }) => {
  const { t } = useTranslation();

  const atLimit = capacity.current >= capacity.recommended;

  return (
    <Stack sx={{ gap: LAYOUT.gapMd, width: '100%' }}>
      <Typography variant='body2'>
        {capacity.current} {t('of about')} {capacity.recommended} {t('cameras on this device')}
      </Typography>

      <MeterBar fraction={capacity.current / Math.max(1, capacity.recommended)} strained={atLimit} />

      <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
        {t('This is a hardware limit. To add more cameras, upgrade the hardware or install Chirp Hub on a computer.')}
      </Typography>
    </Stack>
  );
});
