import { MenuItem, Select, Stack, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { changeLanguage } from '../i18n';
import { DEFAULT_LANGUAGE, isLanguageCode, LANGUAGES } from '../config/languages';
import { LAYOUT } from '../config/defaults';

/** Module scope: it closes over nothing, so it need not be rebuilt per render. */
const handleChange = (event: SelectChangeEvent<unknown>) => {
  const next = String(event.target.value);
  if (isLanguageCode(next)) void changeLanguage(next);
};

/**
 * The sidebar's language picker, matching chirp-frontend's.
 *
 * Shows the two-letter code (`EN`) rather than the full name: it sits in a
 * narrow rail beside the theme switch, and "Português" does not fit. The full
 * names are in the open menu, each written in its own language so someone who
 * has landed in the wrong one can still find their way out.
 *
 * Contract 1 (S): it renders and delegates. The list is a registry
 * (`config/languages.ts`) and persistence belongs to `i18n.ts`.
 */
export const LanguageSelector = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const { i18n } = useTranslation();

  const current = isLanguageCode(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

  // Collapsed, there is no room for a control — the code alone shows which
  // language is active, and the sidebar can be expanded to change it.
  if (isCollapsed) {
    return (
      <Stack direction='row' sx={{ justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Typography sx={{ color: 'neutral.grey4', fontSize: LAYOUT.sidebarFontSize }}>
          {current.toUpperCase()}
        </Typography>
      </Stack>
    );
  }

  return (
    <Select
      value={current}
      onChange={handleChange}
      variant='standard'
      disableUnderline
      renderValue={(value) => String(value).toUpperCase()}
      sx={{
        color: 'neutral.grey4',
        fontSize: LAYOUT.sidebarFontSize,
        '& .MuiSelect-select': { paddingRight: LAYOUT.selectCaretGap },
        '& .MuiSelect-icon': { color: 'neutral.grey4' },
      }}
      MenuProps={{
        slotProps: {
          list: {
            sx: { backgroundColor: 'neutral.grey2', '.MuiMenuItem-root': { minHeight: LAYOUT.menuItemHeight } },
          },
        },
      }}
    >
      {Object.entries(LANGUAGES).map(([code, label]) => (
        <MenuItem key={code} value={code}>
          {label}
        </MenuItem>
      ))}
    </Select>
  );
};
