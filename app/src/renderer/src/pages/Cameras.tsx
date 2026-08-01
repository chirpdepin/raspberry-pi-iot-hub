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
import { ScanScope } from '../features/cameras/ScanScope';
import { BLANK_ADD, useCameras } from '../features/cameras/hooks/useCameras';
import { PageAction } from '../features/common/PageAction';
import { PageLayout } from '../features/common/PageLayout';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

/**
 * The Cameras screen.
 *
 * **`[Add camera]` is the main route and scanning is optional.** Discovery only
 * ever finds cameras that advertise themselves, so a user with twenty cameras
 * may see one — the screen has to make that legible rather than let a partial
 * result read as a broken app. `[Add camera]` starts a Twin with no camera
 * attached; the user gives it an address in the Twin, which is where every other
 * camera setting lives anyway.
 *
 * Contract 5: a view. Every decision lives in useCameras.
 */
export const Cameras = memo(() => {
  const { t } = useTranslation();
  const hostQuery = useHostDetailsQuery();

  const {
    cameras,
    capacity,
    scan,
    isScanning,
    busyAddress,
    justAdded,
    pendingRemoval,
    errorMessage,
    handleScan,
    clearScan,
    handleSetUp,
    handleAddBlank,
    handleOpen,
    requestRemove,
    confirmRemove,
    cancelRemove,
    dismissJustAdded,
  } = useCameras();

  const dockerReady = hostQuery.data?.capabilities.cameras.available ?? false;

  const columns = useMemo(
    () => cameraColumns(t, { onOpen: handleOpen, onRemove: requestRemove }),
    [t, handleOpen, requestRemove]
  );

  const scanColumns = useMemo(
    () => discoveredColumns(t, { onSetUp: handleSetUp, busyAddress }),
    [t, handleSetUp, busyAddress]
  );

  return (
    <PageLayout
      title='Cameras'
      subtitle='Record and stream your cameras through Chirp.'
      // Always rendered, never moved. `[Add camera]` is primary and scanning is
      // secondary, because most cameras will never turn up in a scan and
      // setting one up must not depend on being found.
      actions={
        <>
          <PageAction
            label='Add camera'
            onClick={handleAddBlank}
            disabledReason={
              !dockerReady
                ? 'Cameras need Docker, which is not running.'
                : busyAddress === BLANK_ADD
                  ? 'Setting up…'
                  : undefined
            }
          />
          <PageAction
            label={scan ? 'Scan again' : 'Scan for cameras'}
            variant='secondary'
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
        </>
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
          {errorMessage ? <Notice title={errorMessage} tone='error' /> : null}

          {/* Asked, never assumed. Recordings outlive the camera unless the user
              says otherwise, and the screen used to decide that silently. */}
          {pendingRemoval ? (
            <Notice
              title='Remove this camera?'
              description="The camera stops running and disappears from this list. You can set it up again at any time."
              tone='warning'
            >
              <Typography variant='body2'>{pendingRemoval.displayName}</Typography>

              <Stack direction='row' sx={{ gap: LAYOUT.gapLg }}>
                <PageAction label='Remove, keep recordings' showPlus={false} onClick={() => confirmRemove(true)} />
                <PageAction
                  label='Remove and delete recordings'
                  variant='secondary'
                  showPlus={false}
                  onClick={() => confirmRemove(false)}
                />
                <PageAction label='Cancel' variant='secondary' showPlus={false} onClick={cancelRemove} />
              </Stack>
            </Notice>
          ) : null}

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
          {scan ? (
            <>
              <DataTable
                heading='Found on your network'
                data={scan.cameras}
                columns={scanColumns}
                isLoading={isScanning}
                emptyTitle='No cameras found'
                emptyDescription="Only cameras that advertise themselves can be found this way, and many don't. Use Add camera to set one up directly."
              />

              {/* Below the table so it explains the result, and shown whether or
                  not anything was found — one camera out of twenty needs the
                  explanation just as much as none does. */}
              <ScanScope networks={scan.networks} />

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
            emptyDescription='Use Add camera to set one up, or scan to find cameras that advertise themselves.'
          />
        </>
      ) : null}
    </PageLayout>
  );
});
