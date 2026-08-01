import { Stack } from '@mui/material';
import { memo } from 'react';

import { LAYOUT } from '../../config/defaults';

interface MeterBarProps {
  /** 0–1. Clamped here so a caller cannot overflow the track. */
  fraction: number;
  /** Whether this reading is a concern. The caller decides; this only colors. */
  strained?: boolean;
}

/**
 * A horizontal fill bar.
 *
 * Contract 4: extracted so the bar's height, radius and colors are defined once.
 * The camera-capacity bar and the Dashboard's load rows draw the identical
 * shape, and two copies would be two places to change one visual decision.
 *
 * It holds no thresholds — `strained` is passed in, because what counts as
 * "too much" is policy and policy lives in a use case, not a component.
 */
export const MeterBar = memo<MeterBarProps>(({ fraction, strained = false }) => (
  <Stack
    sx={(theme) => ({
      height: LAYOUT.gapMd,
      borderRadius: LAYOUT.radiusSm,
      backgroundColor: theme.palette.action.hover,
      overflow: 'hidden',
    })}
  >
    <Stack
      sx={(theme) => ({
        height: '100%',
        width: `${Math.min(Math.max(fraction, 0), 1) * 100}%`,
        backgroundColor: strained ? theme.palette.warning.main : theme.palette.success.main,
      })}
    />
  </Stack>
));
