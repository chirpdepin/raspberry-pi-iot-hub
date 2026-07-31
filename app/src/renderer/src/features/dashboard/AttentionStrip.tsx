import { Button, Card } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { AttentionItem } from './hooks/useDashboard';

interface AttentionStripProps {
  items: AttentionItem[];
}

/**
 * Appears only when something is genuinely wrong and actionable.
 *
 * A "needs attention" panel that is always present, or that lists things
 * working as intended, trains the user to ignore it — at which point it cannot
 * do its job on the day something really breaks.
 */
export const AttentionStrip = memo<AttentionStripProps>(({ items }) => {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <Stack sx={{ gap: '8px' }}>
      {items.map((item) => (
        <Card key={item.id}>
          <Stack
            direction='row'
            sx={{ alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '4px' }}
          >
            <Typography variant='body1'>{t(item.message)}</Typography>

            <Button variant='primary' size='small' onClick={item.onAction}>
              {t(item.actionLabel)}
            </Button>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
});
