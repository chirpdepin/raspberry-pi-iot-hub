import { PageWrapper, StackRow } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT } from '../../config/defaults';

interface PageLayoutProps {
  /** English text used as the i18n key. */
  title: string;
  /** Optional English text used as the i18n key, shown under the title. */
  subtitle?: string;
  /**
   * The page's actions, **always rendered**, top-right.
   *
   * Not conditional on the page having content. Chirp's Alarm screen keeps them
   * there in every state, and it is the better behaviour: nothing jumps when
   * the first item appears, and the alternative needs a branch per screen whose
   * only job is to move a button.
   *
   * An action that cannot work yet belongs here **disabled with a reason**,
   * never hidden — hiding it changes the shape of the header, which is the
   * thing this avoids.
   */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The page skeleton, matching `chirp-frontend/src/modules/Alarm/Alarm.tsx`.
 *
 * Every page renders through this, which is the point: the spacing exists once
 * and cannot drift screen by screen. It had already drifted — `<main>` carried
 * 48px on top of `PageWrapper`'s 24px, so every screen sat at 72px where Chirp
 * sits at 24px.
 *
 * Contract 1 (S): it arranges. It decides nothing, fetches nothing, holds no
 * state. Contract 1 (I): four props — a title, a subtitle, actions and content.
 * Anything screen-specific belongs in the screen.
 */
export const PageLayout = memo<PageLayoutProps>(({ title, subtitle, actions, children }) => {
  const { t } = useTranslation();

  return (
    <PageWrapper>
      <Stack sx={{ gap: LAYOUT.pageGap, width: '100%' }}>
        <Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{
              justifyContent: 'space-between',
              // Stacked on a narrow screen, the actions sit under the title
              // rather than being squeezed beside it.
              alignItems: { xs: 'flex-start', sm: 'center' },
              mb: LAYOUT.headerTitleGap,
            }}
          >
            <Typography variant='h2'>{t(title)}</Typography>

            <StackRow sx={{ gap: LAYOUT.headerActionGap, alignItems: 'center' }}>{actions}</StackRow>
          </Stack>

          {subtitle ? (
            // Hidden on the narrowest screens, as Chirp does: at that width the
            // title and the action already fill the row.
            <Typography
              variant='body2'
              sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}
            >
              {t(subtitle)}
            </Typography>
          ) : null}
        </Stack>

        <Stack sx={{ gap: LAYOUT.bodyGap, width: '100%' }}>{children}</Stack>
      </Stack>
    </PageWrapper>
  );
});
