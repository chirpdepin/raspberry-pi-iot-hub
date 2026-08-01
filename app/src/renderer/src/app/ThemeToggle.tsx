import { useTranslation } from 'react-i18next';
import { Stack, Typography } from '@mui/material';
import { ThemeSwitch } from '@chirpwireless/ui-kit/primitives';

import { useThemeMode } from '../theme/ThemeModeContext';
import { LAYOUT } from '../config/defaults';

/**
 * Light/dark toggle, matching chirp-frontend's sidebar row: the current mode
 * named beside the switch, with the whole row clickable.
 *
 * The label names the mode you are **in** rather than the one you would move
 * to — that is chirp's wording, and it pairs with the switch position, which
 * already shows the direction of travel. The `aria-label` still describes the
 * action, because a screen reader gets no switch position.
 *
 * Contract 4: the palettes come from the ui-kit theme; this only chooses.
 */
export const ThemeToggle = () => {
  const { t } = useTranslation();
  const { mode, toggle } = useThemeMode();

  const isDark = mode === 'dark';

  return (
    <Stack direction='row' onClick={toggle} sx={{ alignItems: 'center', gap: LAYOUT.themeToggleGap, cursor: 'pointer' }}>
      <Typography sx={{ color: 'neutral.grey4', fontSize: LAYOUT.sidebarFontSize }}>
        {t(isDark ? 'Dark' : 'Light')}
      </Typography>

      {/* MUI v9 replaced Switch's `inputProps` with `slotProps.input`. */}
      <ThemeSwitch
        checked={isDark}
        slotProps={{
          input: { 'aria-label': isDark ? t('Switch to light mode') : t('Switch to dark mode') },
        }}
      />
    </Stack>
  );
};
