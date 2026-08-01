import { Button, Card } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConcentratorInfo } from '@shared/ipc';

interface ConcentratorDetailsProps {
  concentrator: ConcentratorInfo;
}

/**
 * The detected radio, read-only.
 *
 * Contract 2 rule 3: the EUI is shown with a copy button and is never an input.
 * It is read from the chip, so asking the user to type sixteen hex characters
 * would be inviting a typo into the one identifier that must be exact.
 */
export const ConcentratorDetails = memo<ConcentratorDetailsProps>(({ concentrator }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(concentrator.eui);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const rows = [
    { label: 'Radio', value: concentrator.model },
    { label: 'Connection', value: concentrator.interface },
  ];

  return (
    <Card>
      <Stack sx={{ gap: '8px', padding: '4px' }}>
        <Stack direction='row' sx={{ alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <Stack sx={{ gap: '2px' }}>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t('Gateway EUI')}
            </Typography>
            <Typography variant='body1' sx={{ fontFamily: 'Simplon mono, monospace' }}>
              {concentrator.eui}
            </Typography>
          </Stack>

          <Button variant='secondary' size='small' onClick={handleCopy}>
            {copied ? t('Copied') : t('Copy')}
          </Button>
        </Stack>

        {rows.map((row) => (
          <Stack key={row.label} direction='row' sx={{ justifyContent: 'space-between', gap: '16px' }}>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t(row.label)}
            </Typography>
            <Typography variant='body2'>{row.value}</Typography>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
});
