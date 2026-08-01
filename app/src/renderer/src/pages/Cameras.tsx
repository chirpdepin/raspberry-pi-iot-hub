import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CAPABILITY_COPY } from '../config/capabilities';
import { DataTable } from '../features/common/DataTable';
import { EmptyState } from '../features/common/EmptyState';
import { AddCameraWizard } from '../features/cameras/AddCameraWizard';
import { cameraColumns } from '../features/cameras/columns';
import { CapacityBar } from '../features/cameras/CapacityBar';
import { useCameras } from '../features/cameras/hooks/useCameras';
import { PageAction } from '../features/common/PageAction';
import { PageLayout } from '../features/common/PageLayout';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

/**
 * The Cameras screen.
 *
 * Docker missing is its own state; otherwise the table is always rendered and
 * owns its empty message, so adding the first camera changes a row rather than
 * the shape of the page. The wizard opens over the top.
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
    handleOpen,
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

  const columns = useMemo(
    () => cameraColumns(t, { onOpen: handleOpen, onRemove: (id) => handleRemove(id, true) }),
    [t, handleOpen, handleRemove]
  );

  return (
    <PageLayout
      title='Cameras'
      subtitle='Record and stream your cameras through Chirp.'
      // Always rendered, never moved. Without Docker it says why rather than
      // disappearing, so the header keeps its shape in every state.
      actions={
        <PageAction
          label='Add camera'
          onClick={openWizard}
          disabledReason={dockerReady ? undefined : 'Cameras need Docker, which is not running.'}
        />
      }
    >
      {/* Docker missing is its own state: cameras cannot run without it, and
          "no cameras yet" would send the user looking for a camera problem. */}
      {!dockerReady ? (
        <EmptyState
          title={CAPABILITY_COPY.cameras.emptyTitle}
          description='Cameras run in Docker on this device. Install it from Settings and this page will be ready.'
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

      {dockerReady && !isAdding ? (
        <>
          {capacity ? <CapacityBar capacity={capacity} /> : null}

          <DataTable
            data={cameras}
            columns={columns}
            emptyTitle={CAPABILITY_COPY.cameras.unconfiguredTitle}
            emptyDescription='Use Add camera to set up your first one.'
          />
        </>
      ) : null}
    </PageLayout>
  );
});
