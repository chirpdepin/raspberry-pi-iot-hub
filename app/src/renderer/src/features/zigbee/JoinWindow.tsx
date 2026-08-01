import { Button, Card } from '@chirpwireless/ui-kit/primitives';
import { CircularProgress, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { JOIN_WINDOW_SECONDS, LAYOUT } from '../../config/defaults';

interface JoinWindowProps {
  secondsRemaining: number;
  onStop: () => void;
}

/**
 * The pairing window, with a visible countdown.
 *
 * Contract 2 rule 1 and 5: the instructions are **physical and device-specific**
 * — "turn it off and on 5 times" — because "put the device in pairing mode"
 * assumes knowledge the user does not have. The countdown is visible so the
 * user knows how long they have, and the window closes itself, because a
 * permanently open Zigbee network lets any nearby device join uninvited.
 */
export const JoinWindow = memo<JoinWindowProps>(({ secondsRemaining, onStop }) => {
  const { t } = useTranslation();

  const progress = (secondsRemaining / JOIN_WINDOW_SECONDS) * 100;

  return (
    <Card>
      <Stack sx={{ gap: LAYOUT.gapXl, padding: LAYOUT.gapLg }}>
        <Stack direction='row' sx={{ gap: LAYOUT.gapXl, alignItems: 'center' }}>
          <Stack sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress variant='determinate' value={progress} size={40} />
            <Stack
              sx={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant='body2'>{secondsRemaining}</Typography>
            </Stack>
          </Stack>

          <Stack sx={{ gap: LAYOUT.gapXs }}>
            <Typography variant='body1'>{t('Searching for new devices…')}</Typography>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {t('For a bulb: turn it off and on 5 times in a row until it flashes.')}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction='row' sx={{ justifyContent: 'flex-end' }}>
          <Button variant='secondary' size='small' onClick={onStop}>
            {t('Stop searching')}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
});
