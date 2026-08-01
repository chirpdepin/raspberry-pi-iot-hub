import { Button, EmptyBlock } from '@chirpwireless/ui-kit/primitives';
import { Stack } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChirpMark } from '../../assets/chirp/ChirpMark';
import { LAYOUT } from '../../config/defaults';

interface EmptyStateProps {
  /** English text used as the i18n key. */
  title: string;
  /** Optional English text used as the i18n key. */
  description?: string;
  /** Primary action label — English text used as the i18n key. */
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary action label — English text used as the i18n key. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * The one empty state used everywhere, matching
 * `chirp-frontend/src/features/Devices/DevicesEmptyBlock`.
 *
 * **The title goes through `EmptyBlock`'s `title` prop rather than a
 * `Typography` of our own.** That is the whole reason these screens looked
 * wrong: the kit renders `title` at 12px uppercase, and hand-rolling it as an
 * `h6` produced a heading three times the size with no icon above it. The kit
 * owns this typography — the only way to match Chirp is to let it.
 *
 * Contract 2 rule 4: it always states what is missing and offers exactly one
 * primary action. A screen that renders nothing and explains nothing is the most
 * common way a non-technical user concludes the product is broken.
 */
export const EmptyState = memo<EmptyStateProps>(
  ({ title, description, actionLabel, onAction, secondaryLabel, onSecondary }) => {
    const { t } = useTranslation();

    return (
      <EmptyBlock
        title={t(title)}
        // `neutral.primary` rather than the kit's default `neutral.grey4`:
        // Chirp's choice, and the default is too faint for the one sentence on
        // an otherwise empty screen.
        textColor='neutral.primary'
        icon={<ChirpMark width={LAYOUT.emptyIconSize} height={LAYOUT.emptyIconSize} />}
        sx={{ marginTop: { xs: LAYOUT.emptyTopMarginMobile, lg: 0 }, minHeight: LAYOUT.emptyMinHeight }}
      >
        <Stack sx={{ alignItems: 'center', gap: { xs: LAYOUT.cardGap, lg: LAYOUT.emptyActionGap } }}>
          {description ? t(description) : null}

          {actionLabel || secondaryLabel ? (
            <Stack direction='row' sx={{ gap: LAYOUT.themeToggleGap, flexWrap: 'wrap', justifyContent: 'center' }}>
              {actionLabel && onAction ? (
                <Button variant='primary' size='medium' onClick={onAction}>
                  {t(actionLabel)}
                </Button>
              ) : null}

              {secondaryLabel && onSecondary ? (
                <Button variant='secondary' size='medium' onClick={onSecondary}>
                  {t(secondaryLabel)}
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </EmptyBlock>
    );
  }
);
