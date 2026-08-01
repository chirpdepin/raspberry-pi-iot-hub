import { Stack, Typography } from '@mui/material';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CAPABILITY_COPY } from '../config/capabilities';
import { LAYOUT } from '../config/defaults';
import { DataTable } from '../features/common/DataTable';
import { EmptyState } from '../features/common/EmptyState';
import { Notice } from '../features/common/Notice';
import { cameraColumns, discoveredColumns } from '../features/cameras/columns';
import { CapacityBar } from '../features/cameras/CapacityBar';
import { useCameras } from '../features/cameras/hooks/useCameras';
import { PageAction } from '../features/common/PageAction';
import { PageLayout } from '../features/common/PageLayout';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

/**
 * The Cameras screen.
 *
 * **Two tables, one flow.** The configured cameras are the page; scanning adds
 * a second table of what is on the network, and clicking a row there sets that
 * camera up and opens it. There is no wizard between the two — the Twin's own
 * UI is where a camera is configured, so getting the user there *is* the setup.
 *
 * Contract 5: a view. Every decision lives in useCameras.
 */
export const Cameras = memo(() => {
  const { t } = useTranslation();
  const hostQuery = useHostDetailsQuery();

  const {
    cameras,
    capacity,
    availability,
    discovered,
    isScanning,
    busyAddress,
    justAdded,
    errorMessage,
    handleScan,
    clearScan,
    handleSetUp,
    handleOpen,
    handleRemove,
    dismissJustAdded,
  } = useCameras();

  const dockerReady = hostQuery.data?.capabilities.cameras.available ?? false;
  const canAdd = availability?.canAdd ?? false;

  const columns = useMemo(
    () => cameraColumns(t, { onOpen: handleOpen, onRemove: (id) => handleRemove(id, true) }),
    [t, handleOpen, handleRemove]
  );

  const scanColumns = useMemo(
    () => discoveredColumns(t, { onSetUp: handleSetUp, busyAddress, canAdd }),
    [t, handleSetUp, busyAddress, canAdd]
  );

  return (
    <PageLayout
      title='Cameras'
      subtitle='Record and stream your cameras through Chirp.'
      // Always rendered, never moved. Scanning is never blocked: finding your
      // cameras proves they are reachable, which is useful even when setting
      // one up is not available yet.
      actions={
        <PageAction
          label={discovered ? 'Scan again' : 'Scan for cameras'}
          showPlus={false}
          onClick={handleScan}
          disabledReason={
            dockerReady
              ? isScanning
                ? 'Looking for cameras on your network…'
                : undefined
              : 'Cameras need Docker, which is not running.'
          }
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

      {dockerReady ? (
        <>
          {/* Stated up front rather than discovered halfway through setting a
              camera up, which is where it used to fail. */}
          {availability && !availability.canAdd ? (
            <Notice title={availability.reason ?? ''} description={availability.technicalDetail} tone='warning' />
          ) : null}

          {errorMessage ? <Notice title={errorMessage} tone='error' /> : null}

          {justAdded ? (
            <Notice
              title='Your camera is ready.'
              description='Sign in with these details the first time. The camera will ask you to choose your own password, and these stop working.'
              onDismiss={dismissJustAdded}
            >
              <Stack sx={{ gap: LAYOUT.gapSm }}>
                <Typography variant='body2'>
                  {t('Username')}: {justAdded.firstLoginUsername}
                </Typography>
                <Typography variant='body2'>
                  {t('Password')}: {justAdded.firstLoginPassword}
                </Typography>
              </Stack>

              <Stack direction='row' sx={{ gap: LAYOUT.gapLg }}>
                <PageAction label='Open camera' showPlus={false} onClick={() => handleOpen(justAdded.id)} />
              </Stack>
            </Notice>
          ) : null}

          {capacity ? <CapacityBar capacity={capacity} /> : null}

          {/* Results come first. The user pressed Scan a moment ago and this is
              the answer; leaving it under a full-height empty state put it
              below the fold on the one screen where it was the whole point. */}
          {discovered ? (
            <>
              <DataTable
                heading='Found on your network'
                data={discovered}
                columns={scanColumns}
                isLoading={isScanning}
                emptyTitle='No cameras found'
                emptyDescription='Check the camera is powered on and on the same network. Some cameras need ONVIF switched on in their own settings.'
              />

              <Stack direction='row' sx={{ gap: LAYOUT.gapLg }}>
                <PageAction label='Hide results' variant='secondary' showPlus={false} onClick={clearScan} />
              </Stack>
            </>
          ) : null}

          <DataTable
            heading='Your cameras'
            data={cameras}
            columns={columns}
            emptyTitle={CAPABILITY_COPY.cameras.unconfiguredTitle}
            emptyDescription='Scan for cameras to set up your first one.'
          />
        </>
      ) : null}
    </PageLayout>
  );
});
