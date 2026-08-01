import { Typography } from '@mui/material';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CAPABILITY_COPY } from '../config/capabilities';
import { DataTable } from '../features/common/DataTable';
import { EmptyState } from '../features/common/EmptyState';
import { PageAction } from '../features/common/PageAction';
import { PageLayout } from '../features/common/PageLayout';
import { coordinatorColumns, deviceColumns } from '../features/zigbee/columns';
import { JoinWindow } from '../features/zigbee/JoinWindow';
import { useZigbee } from '../features/zigbee/hooks/useZigbee';
import { useConcentratorQuery } from '../services/api/lorawan/hooks/useGatewayQuery';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

/**
 * The Zigbee screen.
 *
 * Two states rather than four: **no coordinator**, a rich empty state naming
 * the hardware needed; and **coordinator present**, a Coordinator table and a
 * Devices table. The devices table owns its own empty message, so pairing the
 * first device changes a row rather than the shape of the page.
 *
 * The actions sit in the header in both states and never move.
 *
 * Contract 5: a view. Every decision lives in useZigbee.
 */
export const Zigbee = memo(() => {
  const { t } = useTranslation();

  const hostQuery = useHostDetailsQuery();
  const concentratorQuery = useConcentratorQuery();

  const hubName = `Chirp Hub — ${hostQuery.data?.host.hostname ?? 'hub'}`;
  const gatewayEui = concentratorQuery.data?.eui ?? null;

  const {
    coordinator,
    isDetecting,
    devices,
    isJoining,
    secondsRemaining,
    errorMessage,
    isStarting,
    handleStart,
    handleAddDevice,
    handleStopJoin,
  } = useZigbee(gatewayEui, hubName);

  const coordinatorCols = useMemo(() => coordinatorColumns(t), [t]);
  const deviceCols = useMemo(() => deviceColumns(t), [t]);

  // Without a coordinator neither action can do anything, so both say why
  // rather than disappearing.
  const noRadio = coordinator ? undefined : 'Plug in a Zigbee dongle first.';

  return (
    <PageLayout
      title='Zigbee'
      subtitle='Pair Zigbee devices and send their readings to Chirp.'
      actions={
        <>
          <PageAction
            label='Start Zigbee'
            variant='secondary'
            showPlus={false}
            onClick={handleStart}
            disabledReason={noRadio ?? (isStarting ? 'Starting…' : undefined)}
          />
          <PageAction label='Add device' onClick={handleAddDevice} disabledReason={noRadio} />
        </>
      }
    >
      {errorMessage ? (
        <Typography variant='body1' sx={{ color: 'error.main' }}>
          {t(errorMessage)}
        </Typography>
      ) : null}

      {isJoining ? <JoinWindow secondsRemaining={secondsRemaining} onStop={handleStopJoin} /> : null}

      {/* Nothing attached: name the hardware needed. Detection is polled, so
          this waits for a scan to have actually completed. */}
      {!coordinator && !isDetecting ? <EmptyState title={CAPABILITY_COPY.zigbee.emptyTitle} /> : null}

      {coordinator ? (
        <>
          <DataTable
            heading='Coordinator'
            data={[coordinator]}
            columns={coordinatorCols}
            emptyTitle={CAPABILITY_COPY.zigbee.emptyTitle}
          />

          <DataTable
            heading='Devices'
            data={devices}
            columns={deviceCols}
            emptyTitle='No devices yet'
            emptyDescription='Use Add device to pair your first one.'
          />
        </>
      ) : null}
    </PageLayout>
  );
});
