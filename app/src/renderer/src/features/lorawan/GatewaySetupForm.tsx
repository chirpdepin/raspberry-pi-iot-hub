import { Button, Select, TextField } from '@chirpwireless/ui-kit/primitives';
import { MenuItem, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface GatewaySetupFormProps {
  name: string;
  region: string;
  regions: readonly string[];
  isBusy: boolean;
  onNameChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * The registration form.
 *
 * Contract 2 rule 3: the EUI is not here, because the user never types it — it
 * is read from the chip and shown read-only above. The name is pre-filled and
 * the region defaults from locale, so both are confirmations rather than
 * questions. The LNS URL is derived and not shown at all.
 */
export const GatewaySetupForm = memo<GatewaySetupFormProps>(
  ({ name, region, regions, isBusy, onNameChange, onRegionChange, onSubmit }) => {
    const { t } = useTranslation();

    return (
      <Stack sx={{ gap: '16px', maxWidth: '480px' }}>
        <TextField
          label={t('Gateway name')}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={isBusy}
          fullWidth
        />

        <Stack sx={{ gap: '4px' }}>
          <Select
            label={t('Region')}
            value={region}
            onChange={(event) => onRegionChange(String(event.target.value))}
            disabled={isBusy}
            fullWidth
          >
            {regions.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>

          <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
            {t('Choose the region where this gateway is installed.')}
          </Typography>
        </Stack>

        <Button variant='primary' size='medium' onClick={onSubmit} disabled={isBusy}>
          {t('Register with Chirp')}
        </Button>
      </Stack>
    );
  }
);
