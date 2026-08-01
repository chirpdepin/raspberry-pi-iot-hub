import { Button } from '@chirpwireless/ui-kit/primitives';
import { LinearProgress, Stack, Typography } from '@mui/material';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LAYOUT } from '../../config/defaults';

import { STEP_LABEL, type SetupStep } from './hooks/useGatewaySetup';

interface SetupProgressProps {
  step: SetupStep;
  errorMessage: string | null;
  technicalDetail: string | null;
}

/**
 * Progress and failure reporting.
 *
 * Contract 2 rule 2: a failure shows a plain-language cause; the raw text stays
 * behind [Technical details] so support can still get at it without the user
 * ever facing a stack trace.
 *
 * The ui-kit has no ProgressBar, so MUI's LinearProgress is used directly — it
 * is not one of the twelve wrapped primitives.
 */
export const SetupProgress = memo<SetupProgressProps>(({ step, errorMessage, technicalDetail }) => {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);

  const handleToggleDetail = () => setShowDetail((current) => !current);

  if (step === 'idle') return null;

  if (step === 'failed') {
    return (
      <Stack sx={{ gap: LAYOUT.gapLg }}>
        <Typography variant='body1' sx={(theme) => ({ color: theme.palette.error.main })}>
          {t(errorMessage ?? 'Something went wrong.')}
        </Typography>

        {technicalDetail ? (
          <Stack sx={{ gap: LAYOUT.gapSm, alignItems: 'flex-start' }}>
            <Button variant='text' size='small' onClick={handleToggleDetail}>
              {t('Technical details')}
            </Button>

            {showDetail ? (
              <Typography
                variant='body2'
                sx={(theme) => ({ color: theme.palette.text.disabled, fontFamily: 'Simplon mono, monospace' })}
              >
                {technicalDetail}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    );
  }

  if (step === 'done') {
    return (
      <Typography variant='body1' sx={(theme) => ({ color: theme.palette.success.main })}>
        {t('Your gateway is connected to Chirp.')}
      </Typography>
    );
  }

  return (
    <Stack sx={{ gap: LAYOUT.gapLg, maxWidth: LAYOUT.setupFormMaxWidth }}>
      <Typography variant='body1'>{t(STEP_LABEL[step])}</Typography>
      <LinearProgress />
    </Stack>
  );
});
