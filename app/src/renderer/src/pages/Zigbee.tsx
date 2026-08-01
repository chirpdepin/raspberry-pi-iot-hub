import { Button, PageWrapper, StackRowJB } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { CAPABILITY_COPY } from '../config/capabilities';
import { LAYOUT } from '../config/defaults';
import { EmptyState } from '../features/common/EmptyState';
import { DeviceRow } from '../features/zigbee/DeviceRow';
import { JoinWindow } from '../features/zigbee/JoinWindow';
import { useZigbee } from '../features/zigbee/hooks/useZigbee';
import { useConcentratorQuery } from '../services/api/lorawan/hooks/useGatewayQuery';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

/**
 * The Zigbee screen.
 *
 * Four states, each with one primary action: no coordinator, coordinator but
 * stack not started, started with no devices, and the device list.
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
    handleLinkDevice,
  } = useZigbee(gatewayEui, hubName);

  const hasDevices = devices.length > 0;

  return (
    <PageWrapper>
      <Stack sx={{ gap: LAYOUT.pageGap, width: '100%' }}>
        <StackRowJB>
          <Typography variant='h2'>{t('Zigbee')}</Typography>

          {coordinator && !isJoining ? (
            <Button variant='primary' size='medium' onClick={handleAddDevice}>
              {t('Add device')}
            </Button>
          ) : null}
        </StackRowJB>

        {errorMessage ? (
          <Typography variant='body1' sx={(theme) => ({ color: theme.palette.error.main })}>
            {t(errorMessage)}
          </Typography>
        ) : null}

        {!coordinator && !isDetecting ? (
          <EmptyState title={CAPABILITY_COPY.zigbee.emptyTitle} secondaryLabel={CAPABILITY_COPY.zigbee.learnMore} />
        ) : null}

        {coordinator ? (
          <Stack sx={{ gap: '16px' }}>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {coordinator.model} · {coordinator.port}
            </Typography>

            {isJoining ? <JoinWindow secondsRemaining={secondsRemaining} onStop={handleStopJoin} /> : null}

            {hasDevices ? (
              devices.map((device) => <DeviceRow key={device.ieeeAddress} device={device} onLink={handleLinkDevice} />)
            ) : isJoining ? null : (
              <EmptyState
                title={CAPABILITY_COPY.zigbee.unconfiguredTitle}
                actionLabel={isStarting ? 'Starting…' : CAPABILITY_COPY.zigbee.unconfiguredAction}
                onAction={handleAddDevice}
                secondaryLabel='Start Zigbee'
                onSecondary={handleStart}
              />
            )}
          </Stack>
        ) : null}
      </Stack>
    </PageWrapper>
  );
});
