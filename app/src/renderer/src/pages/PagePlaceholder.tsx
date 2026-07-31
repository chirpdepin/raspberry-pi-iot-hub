import { PageWrapper, StackRowJB } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { NavItem } from '../config/navigation';

interface PagePlaceholderProps {
  item: NavItem;
}

/**
 * Shared page scaffold until each section grows its real content in Phases 4–8.
 *
 * Follows the chirp page layout convention: `PageWrapper`, a `StackRowJB` header
 * row with `Typography variant='h2'`, and a 24px-gap body Stack — so these
 * screens already sit correctly when real content replaces the placeholder.
 *
 * Note chirp-frontend documents this as `<Stack gap='24px' width='100%'>`, which
 * is MUI v7 syntax. MUI v9 removed system props from Stack, so the same values
 * go through `sx`.
 */
export const PagePlaceholder = memo<PagePlaceholderProps>(({ item }) => {
  const { t } = useTranslation();

  return (
    <PageWrapper>
      <Stack sx={{ gap: '24px', width: '100%' }}>
        <StackRowJB>
          <Typography variant='h2'>{t(item.label)}</Typography>
        </StackRowJB>

        <Typography variant='body1' sx={(theme) => ({ color: theme.palette.text.secondary })}>
          {t(item.subtitle)}
        </Typography>

        <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.disabled })}>
          {t('This section is being built.')}
        </Typography>
      </Stack>
    </PageWrapper>
  );
});
