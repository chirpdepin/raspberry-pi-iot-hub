import { PageWrapper, StackRowJB } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT } from '../../config/defaults';

interface PageLayoutProps {
  /** English text used as the i18n key. */
  title: string;
  /**
   * The page's primary action, rendered **top-right** beside the title.
   *
   * Follow Chirp's rule and pass this only when the page has content: with
   * nothing to show, the action belongs in the empty state instead, where it is
   * the obvious next step rather than a control in the corner.
   */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * The page skeleton, matching `chirp-frontend/src/modules/Connectors/Connectors.tsx`.
 *
 * Every page renders through this, which is the point: the spacing exists in
 * one place and cannot drift screen by screen. It had already drifted — `<main>`
 * carried `theme.spacing(6)` (48px, since the kit uses MUI's default base of 8)
 * on top of `PageWrapper`'s own 24px, so every screen sat 72px inset where Chirp
 * sits at 24px.
 *
 * Contract 1 (S): it arranges. It decides nothing, fetches nothing, and holds no
 * state. Contract 4: all gaps come from `LAYOUT`.
 */
export const PageLayout = memo<PageLayoutProps>(({ title, action, children }) => {
  const { t } = useTranslation();

  return (
    <PageWrapper>
      <Stack sx={{ gap: LAYOUT.pageGap, width: '100%' }}>
        <Stack sx={{ gap: LAYOUT.headerGap }}>
          <StackRowJB gap={LAYOUT.headerRowGap} sx={{ width: '100%' }}>
            <Typography variant='h2'>{t(title)}</Typography>
            {action}
          </StackRowJB>
        </Stack>

        <Stack sx={{ gap: LAYOUT.bodyGap, width: '100%' }}>{children}</Stack>
      </Stack>
    </PageWrapper>
  );
});
