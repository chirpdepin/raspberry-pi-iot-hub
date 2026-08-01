import { Stack } from '@mui/material';
import { memo, useState } from 'react';

import { CAPABILITY_COPY } from '../config/capabilities';
import { LAYOUT } from '../config/defaults';
import { EmptyState } from '../features/common/EmptyState';
import { AddCameraWizard } from '../features/cameras/AddCameraWizard';
import { CameraRow } from '../features/cameras/CameraRow';
import { CapacityBar } from '../features/cameras/CapacityBar';
import { useCameras } from '../features/cameras/hooks/useCameras';
import { PageAction } from '../features/common/PageAction';
import { PageLayout } from '../features/common/PageLayout';
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

  const hostQuery = useHostDetailsQuery();
  const [isAdding, setIsAdding] = useState(false);

  const {
    cameras,
    capacity,
    discovered,
    isScanning,
    hasScannedEmpty,
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
    handleManual,
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

  const hasCameras = cameras.length > 0;

  return (
    <PageLayout
      title='Cameras'
      // Chirp's rule: the header action appears only once the page has content.
      // With no cameras, "Scan for cameras" belongs in the empty state — that is
      // where the user is looking, and a corner button competes with it.
      action={dockerReady && hasCameras && !isAdding ? <PageAction label='Add camera' onClick={openWizard} /> : null}
    >
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
          hasScannedEmpty={hasScannedEmpty}
          isTesting={isTesting}
          isAdding={isSubmitting}
          config={config}
          frame={frame}
          errorMessage={errorMessage}
          onScan={handleScan}
          onSelect={handleSelect}
          onManual={handleManual}
          onChange={updateConfig}
          onTest={handleTestConnection}
          onAdd={handleAdd}
          onBack={setStep}
          onFinish={closeWizard}
        />
      ) : null}

      {dockerReady && !isAdding && !hasCameras ? (
        <EmptyState
          title={CAPABILITY_COPY.cameras.unconfiguredTitle}
          actionLabel={CAPABILITY_COPY.cameras.unconfiguredAction}
          onAction={openWizard}
        />
      ) : null}

      {dockerReady && !isAdding && hasCameras ? (
        <Stack sx={{ gap: LAYOUT.cardGap, width: '100%' }}>
          {capacity ? <CapacityBar capacity={capacity} /> : null}

          {cameras.map((camera) => (
            // Recordings are kept: removing a camera is usually reorganising,
            // and deleting a container is reversible where recordings are not.
            <CameraRow key={camera.id} camera={camera} onRemove={(id) => handleRemove(id, true)} />
          ))}
        </Stack>
      ) : null}
    </PageLayout>
  );
});
