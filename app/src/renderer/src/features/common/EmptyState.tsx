import { Button, EmptyBlock } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

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
 * The one empty state used everywhere.
 *
 * Contract 2 rule 4: it always states what is missing and offers exactly one
 * primary action. A screen that renders nothing and explains nothing is the
 * most common way a non-technical user concludes the product is broken.
 */
export const EmptyState = memo<EmptyStateProps>(
  ({ title, description, actionLabel, onAction, secondaryLabel, onSecondary }) => {
    const { t } = useTranslation();

    return (
      <EmptyBlock>
        <Stack sx={{ alignItems: 'center', gap: '16px', maxWidth: '520px', textAlign: 'center' }}>
          <Typography variant='h6'>{t(title)}</Typography>

          {description ? (
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t(description)}
            </Typography>
          ) : null}

          {actionLabel || secondaryLabel ? (
            <Stack direction='row' sx={{ gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
