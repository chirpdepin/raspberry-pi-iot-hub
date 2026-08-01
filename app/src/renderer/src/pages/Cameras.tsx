import { Button, PageWrapper, StackRowJB } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CAPABILITY_COPY } from '../config/capabilities';
import { LAYOUT } from '../config/defaults';
import { EmptyState } from '../features/common/EmptyState';
import { AddCameraWizard } from '../features/cameras/AddCameraWizard';
import { CameraRow } from '../features/cameras/CameraRow';
import { CapacityBar } from '../features/cameras/CapacityBar';
import { useCameras } from '../features/cameras/hooks/useCameras';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

/**
 * The Cameras screen.
 *
 * Three states: Docker missing, no cameras yet, and the list. The wizard opens
 * over the top of whichever applies.
 *
 * Contract 5: a view. Every decision lives in useCameras.
 */
export const Cameras = memo(() => {
  const { t } = useTranslation();

  const hostQuery = useHostDetailsQuery();
  const [isAdding, setIsAdding] = useState(false);

  const {
    cameras,
    capacity,
    discovered,
    isScanning,
    isTesting,
    isAdding: isSubmitting,
    step,
    config,
    frame,
    errorMessage,
    reset,
    setStep,
    handleScan,
    handleSelect,
    updateConfig,
    handleTestConnection,
    handleAdd,
    handleRemove,
  } = useCameras();

  const dockerReady = hostQuery.data?.capabilities.cameras.available ?? false;

  const openWizard = () => {
    reset();
    setIsAdding(true);
  };

  const closeWizard = () => {
    setIsAdding(false);
    reset();
  };

  return (
    <PageWrapper>
      <Stack sx={{ gap: LAYOUT.pageGap, width: '100%' }}>
        <StackRowJB>
          <Typography variant='h2'>{t('Cameras')}</Typography>

          {dockerReady && !isAdding ? (
            <Button variant='primary' size='medium' onClick={openWizard}>
              {t('Add camera')}
            </Button>
          ) : null}
        </StackRowJB>

        {/* Docker missing is its own state: cameras cannot run without it, and
            "no cameras yet" would send the user looking for a camera problem. */}
        {!dockerReady ? (
          <EmptyState
            title={CAPABILITY_COPY.cameras.emptyTitle}
            description='Cameras run in Docker on this device. Install it from Settings and this page will be ready.'
            actionLabel='Open Settings'
            onAction={() => undefined}
          />
        ) : null}

        {dockerReady && isAdding ? (
          <AddCameraWizard
            step={step}
            discovered={discovered}
            isScanning={isScanning}
            isTesting={isTesting}
            isAdding={isSubmitting}
            config={config}
            frame={frame}
            errorMessage={errorMessage}
            onScan={handleScan}
            onSelect={handleSelect}
            onChange={updateConfig}
            onTest={handleTestConnection}
            onAdd={handleAdd}
            onBack={setStep}
            onFinish={closeWizard}
          />
        ) : null}

        {dockerReady && !isAdding && cameras.length === 0 ? (
          <EmptyState
            title={CAPABILITY_COPY.cameras.unconfiguredTitle}
            actionLabel={CAPABILITY_COPY.cameras.unconfiguredAction}
            onAction={openWizard}
          />
        ) : null}

        {dockerReady && !isAdding && cameras.length > 0 ? (
          <Stack sx={{ gap: LAYOUT.cardGap, width: '100%' }}>
            {capacity ? <CapacityBar capacity={capacity} /> : null}

            {cameras.map((camera) => (
              // Recordings are kept: removing a camera is usually reorganising,
              // and deleting a container is reversible where recordings are not.
              <CameraRow key={camera.id} camera={camera} onRemove={(id) => handleRemove(id, true)} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </PageWrapper>
  );
});
