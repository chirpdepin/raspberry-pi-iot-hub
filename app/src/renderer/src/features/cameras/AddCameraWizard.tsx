import { Button, Card, TextField } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraConfigPayload, CameraProbePayload, DiscoveredCameraPayload } from '@shared/ipc';

import { LAYOUT } from '../../config/defaults';
import type { WizardStep } from './hooks/useCameras';

interface AddCameraWizardProps {
  step: WizardStep;
  discovered: DiscoveredCameraPayload[];
  isScanning: boolean;
  isTesting: boolean;
  isAdding: boolean;
  config: CameraConfigPayload | null;
  frame: CameraProbePayload | null;
  errorMessage: string | null;
  onScan: () => void;
  onSelect: (camera: DiscoveredCameraPayload) => void;
  onChange: (patch: Partial<CameraConfigPayload>) => void;
  onTest: () => void;
  onAdd: () => void;
  onBack: (step: WizardStep) => void;
  onFinish: () => void;
}

/**
 * Scan → pick → password → **see your camera** → name → done.
 *
 * The preview step exists because a picture of their own camera is the only
 * thing that tells a non-technical person the credentials were right
 * (Contract 2 rule 5). RTSP paths and ONVIF ports never appear on this path.
 */
export const AddCameraWizard = memo<AddCameraWizardProps>(
  ({
    step,
    discovered,
    isScanning,
    isTesting,
    isAdding,
    config,
    frame,
    errorMessage,
    onScan,
    onSelect,
    onChange,
    onTest,
    onAdd,
    onBack,
    onFinish,
  }) => {
    const { t } = useTranslation();

    return (
      <Stack sx={{ gap: LAYOUT.pageGap, width: '100%' }} data-testid='add-camera-wizard'>
        {errorMessage ? (
          <Typography variant='body2' sx={(theme) => ({ color: theme.palette.error.main })}>
            {t(errorMessage)}
          </Typography>
        ) : null}

        {step === 'discover' ? (
          <Stack sx={{ gap: '16px' }}>
            <Typography variant='body1'>{t('Chirp Hub can find cameras on your network automatically.')}</Typography>

            <Stack direction='row' sx={{ gap: '12px' }}>
              <Button variant='primary' size='medium' onClick={onScan} disabled={isScanning}>
                {t(isScanning ? 'Scanning…' : 'Scan for cameras')}
              </Button>
            </Stack>

            {discovered.map((camera) => (
              <Card key={camera.xaddr}>
                <Stack
                  direction='row'
                  sx={{ justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '8px' }}
                >
                  <Stack sx={{ gap: '2px' }}>
                    <Typography variant='body1'>
                      {[camera.manufacturer, camera.model].filter(Boolean).join(' ') || t('Camera')}
                    </Typography>
                    <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
                      {camera.address}
                    </Typography>
                  </Stack>

                  <Button variant='primary' size='small' onClick={() => onSelect(camera)}>
                    {t('Select')}
                  </Button>
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : null}

        {step === 'connect' && config ? (
          <Stack sx={{ gap: '16px', maxWidth: '420px' }}>
            <Typography variant='body1'>{t('Enter the camera’s username and password.')}</Typography>

            <TextField
              label={t('Username')}
              value={config.credentials.username}
              onChange={(event) =>
                onChange({ credentials: { ...config.credentials, username: event.target.value } })
              }
            />

            <TextField
              label={t('Password')}
              type='password'
              value={config.credentials.password}
              onChange={(event) =>
                onChange({ credentials: { ...config.credentials, password: event.target.value } })
              }
            />

            <Stack direction='row' sx={{ gap: '12px' }}>
              <Button variant='secondary' size='medium' onClick={() => onBack('discover')}>
                {t('Back')}
              </Button>
              <Button variant='primary' size='medium' onClick={onTest} disabled={isTesting}>
                {t(isTesting ? 'Connecting…' : 'Test connection')}
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {step === 'preview' && frame ? (
          <Stack sx={{ gap: '16px', maxWidth: '640px' }}>
            <Typography variant='body1'>{t('This is what the camera sees right now.')}</Typography>

            <img src={frame.frameDataUrl} alt={t('Camera preview')} style={{ width: '100%', borderRadius: '8px' }} />

            <Stack direction='row' sx={{ gap: '12px' }}>
              <Button variant='secondary' size='medium' onClick={() => onBack('connect')}>
                {t('Back')}
              </Button>
              <Button variant='primary' size='medium' onClick={() => onBack('settings')}>
                {t('Looks right — continue')}
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {step === 'settings' && config ? (
          <Stack sx={{ gap: '16px', maxWidth: '420px' }}>
            <TextField
              label={t('Camera name')}
              value={config.displayName}
              onChange={(event) => onChange({ displayName: event.target.value })}
            />

            <Stack direction='row' sx={{ gap: '12px' }}>
              <Button variant='secondary' size='medium' onClick={() => onBack('preview')}>
                {t('Back')}
              </Button>
              <Button variant='primary' size='medium' onClick={onAdd} disabled={isAdding}>
                {t(isAdding ? 'Setting up…' : 'Add camera')}
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {step === 'done' ? (
          <Stack sx={{ gap: '16px' }}>
            <Typography variant='body1'>{t('Your camera is set up and recording.')}</Typography>

            <Stack direction='row' sx={{ gap: '12px' }}>
              <Button variant='primary' size='medium' onClick={onFinish}>
                {t('Finish')}
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    );
  }
);
