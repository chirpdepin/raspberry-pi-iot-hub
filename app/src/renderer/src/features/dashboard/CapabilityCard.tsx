import { Card } from '@chirpwireless/ui-kit/primitives';
import { Box, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { CapabilityCard as CapabilityCardModel } from './hooks/useDashboard';

interface CapabilityCardProps {
  card: CapabilityCardModel;
}

/**
 * One dashboard card per capability.
 *
 * Contract 2 rule 4: an unavailable capability is **shown with its reason**, not
 * hidden. A user who cannot find LoRaWAN assumes the app is broken; one who is
 * told it needs a concentrator on a Pi HAT knows what to buy.
 */
export const CapabilityCard = memo<CapabilityCardProps>(({ card }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleOpen = () => navigate(card.path);

  return (
    <Card onClick={handleOpen} sx={{ cursor: 'pointer', height: '100%' }}>
      <Stack sx={{ gap: '8px', padding: '4px', height: '100%' }}>
        <Stack direction='row' sx={{ alignItems: 'center', gap: '8px' }}>
          <Box
            sx={(theme) => ({
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: card.available ? theme.palette.success.main : theme.palette.text.disabled,
            })}
          />
          <Typography variant='h6'>{t(card.label)}</Typography>
        </Stack>

        <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
          {card.available ? t('Ready') : t(card.reason ?? 'Not available on this computer.')}
        </Typography>
      </Stack>
    </Card>
  );
});
