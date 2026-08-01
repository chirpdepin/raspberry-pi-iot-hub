import { Button, Card, TextField } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraConfigPayload, CameraProbePayload, DiscoveredCameraPayload } from '@shared/ipc';

import { LAYOUT } from '../../config/defaults';
import type { WizardStep } from './hooks/useCameras';

interface AddCameraWizardProps {
  step: WizardStep;
  discovered: DiscoveredCameraPayload[];
  isScanning: boolean;
  /** True when a scan completed and the network genuinely had no cameras. */
  hasScannedEmpty: boolean;
  isTesting: boolean;
  isAdding: boolean;
  config: CameraConfigPayload | null;
  frame: CameraProbePayload | null;
  errorMessage: string | null;
  onScan: () => void;
  onSelect: (camera: DiscoveredCameraPayload) => void;
  onManual: (address: string) => void;
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
    hasScannedEmpty,
    isTesting,
    isAdding,
    config,
    frame,
    errorMessage,
    onScan,
    onSelect,
    onManual,
    onChange,
    onTest,
    onAdd,
    onBack,
    onFinish,
  }) => {
    const { t } = useTranslation();
    const [manualAddress, setManualAddress] = useState('');

    return (
      <Stack sx={{ gap: LAYOUT.pageGap, width: '100%' }} data-testid='add-camera-wizard'>
        {errorMessage ? (
          <Typography variant='body2' sx={(theme) => ({ color: theme.palette.error.main })}>
            {t(errorMessage)}
          </Typography>
        ) : null}

        {step === 'discover' ? (
          <Stack sx={{ gap: LAYOUT.gapXxl }}>
            <Typography variant='body1'>{t('Chirp Hub can find cameras on your network automatically.')}</Typography>

            <Stack direction='row' sx={{ gap: LAYOUT.gapXl }}>
              <Button variant='primary' size='medium' onClick={onScan} disabled={isScanning}>
                {t(isScanning ? 'Scanning…' : 'Scan for cameras')}
              </Button>
            </Stack>

            {/* A scan that found nothing is not the same as one that failed, and
                it is not a dead end either: some cameras have ONVIF switched off
                and can only ever be added by address. */}
            {hasScannedEmpty ? (
              <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
                {t('No cameras answered. Some cameras cannot be found automatically — add one by address below.')}
              </Typography>
            ) : null}

            <Stack sx={{ gap: LAYOUT.gapXl, maxWidth: LAYOUT.narrowFormMaxWidth }}>
              <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
                {t('Know the camera’s address? Add it directly.')}
              </Typography>

              <TextField
                label={t('Camera address')}
                placeholder='192.168.1.64'
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
              />

              <Stack direction='row' sx={{ gap: LAYOUT.gapXl }}>
                <Button
                  variant='secondary'
                  size='medium'
                  disabled={manualAddress.trim().length === 0}
                  onClick={() => onManual(manualAddress.trim())}
                >
                  {t('Add manually')}
                </Button>
              </Stack>
            </Stack>

            {discovered.map((camera) => (
              <Card key={camera.xaddr}>
                <Stack
                  direction='row'
                  sx={{ justifyContent: 'space-between', alignItems: 'center', gap: LAYOUT.gapXxl, padding: LAYOUT.gapLg }}
                >
                  <Stack sx={{ gap: LAYOUT.gapXs }}>
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
          <Stack sx={{ gap: LAYOUT.gapXxl, maxWidth: LAYOUT.narrowFormMaxWidth }}>
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

            <Stack direction='row' sx={{ gap: LAYOUT.gapXl }}>
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
          <Stack sx={{ gap: LAYOUT.gapXxl, maxWidth: LAYOUT.formMaxWidth }}>
            <Typography variant='body1'>{t('This is what the camera sees right now.')}</Typography>

            <img src={frame.frameDataUrl} alt={t('Camera preview')} style={{ width: '100%', borderRadius: LAYOUT.radiusMd }} />

            <Stack direction='row' sx={{ gap: LAYOUT.gapXl }}>
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
          <Stack sx={{ gap: LAYOUT.gapXxl, maxWidth: LAYOUT.narrowFormMaxWidth }}>
            <TextField
              label={t('Camera name')}
              value={config.displayName}
              onChange={(event) => onChange({ displayName: event.target.value })}
            />

            <Stack direction='row' sx={{ gap: LAYOUT.gapXl }}>
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
          <Stack sx={{ gap: LAYOUT.gapXxl }}>
            <Typography variant='body1'>{t('Your camera is set up and recording.')}</Typography>

            <Stack direction='row' sx={{ gap: LAYOUT.gapXl }}>
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
