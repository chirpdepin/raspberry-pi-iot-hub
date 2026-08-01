import { Button } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT } from '../../config/defaults';

interface NoticeProps {
  /** English text used as the i18n key. */
  title: string;
  /** Optional supporting line. English text used as the i18n key. */
  description?: string;
  tone?: 'info' | 'warning' | 'error';
  /** Rendered under the text — a value to read, a next action. */
  children?: ReactNode;
  /** Shown as a dismiss button when supplied. */
  onDismiss?: () => void;
}

/**
 * A panel that says something the user needs to read.
 *
 * Exists because the alternatives on a screen like this are worse: a toast is
 * gone before a password can be copied, and a modal has to be dismissed before
 * the thing it describes can be used. Contract 2 rules 2 and 5 — a cause and a
 * next action, in place, where the user is already looking.
 */
export const Notice = memo<NoticeProps>(({ title, description, tone = 'info', children, onDismiss }) => {
  const { t } = useTranslation();

  return (
    <Stack
      sx={(theme) => ({
        gap: LAYOUT.gapLg,
        padding: LAYOUT.gapXxl,
        borderRadius: LAYOUT.radiusMd,
        border: `1px solid ${theme.palette[tone === 'info' ? 'primary' : tone].main}`,
        backgroundColor: theme.palette.action.hover,
      })}
    >
      <Stack direction='row' sx={{ justifyContent: 'space-between', gap: LAYOUT.gapXxl }}>
        {/* body1, not subtitle2: this theme renders subtitle2 in the monospace
            face, which made a plain sentence read as a code sample. */}
        <Typography variant='body1'>{t(title)}</Typography>

        {onDismiss ? (
          <Button variant='secondary' size='small' onClick={onDismiss}>
            {t('Dismiss')}
          </Button>
        ) : null}
      </Stack>

      {description ? <Typography variant='body2'>{t(description)}</Typography> : null}

      {children}
    </Stack>
  );
});
