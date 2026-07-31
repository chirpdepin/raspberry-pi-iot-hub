import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import { ThemeSwitch } from '@chirpwireless/ui-kit/primitives';

import { useThemeMode } from '../theme/ThemeModeContext';

/**
 * Light/dark toggle in the sidebar's bottom slot.
 *
 * Contract 4: the actual palettes come from the ui-kit theme — this only chooses
 * between them. Contract 2 rule 4: the label says what will happen, not what the
 * current state is, so the action is unambiguous.
 */
export const ThemeToggle = () => {
    const { t } = useTranslation();
    const { mode, toggle } = useThemeMode();

    return (
        <Box sx={(theme) => ({ padding: theme.spacing(2) })}>
            {/* MUI v9 replaced Switch's `inputProps` with `slotProps.input`. */}
            <ThemeSwitch
                checked={mode === 'dark'}
                onChange={toggle}
                slotProps={{
                    input: {
                        'aria-label':
                            mode === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark'),
                    },
                }}
            />
        </Box>
    );
};
