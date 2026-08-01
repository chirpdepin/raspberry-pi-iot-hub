import { Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { NavItem } from '../config/navigation';
import { PageLayout } from '../features/common/PageLayout';

interface PagePlaceholderProps {
  item: NavItem;
}

/**
 * Shared page scaffold until each section grows its real content in Phases 4–8.
 *
 * The chirp page skeleton comes from `PageLayout`, so these screens already sit
 * correctly when real content replaces the placeholder.
 */
export const PagePlaceholder = memo<PagePlaceholderProps>(({ item }) => {
  const { t } = useTranslation();

  return (
    <PageLayout title={item.label} subtitle={item.subtitle}>
      <Typography variant='body2' sx={{ color: 'text.disabled' }}>
        {t('This section is being built.')}
      </Typography>
    </PageLayout>
  );
});
