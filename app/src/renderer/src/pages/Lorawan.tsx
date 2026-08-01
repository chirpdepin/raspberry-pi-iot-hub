import { Stack } from '@mui/material';
import { memo } from 'react';

import { CAPABILITY_COPY } from '../config/capabilities';
import { LAYOUT } from '../config/defaults';
import { EmptyState } from '../features/common/EmptyState';
import { PageLayout } from '../features/common/PageLayout';
import { ConcentratorDetails } from '../features/lorawan/ConcentratorDetails';
import { GatewaySetupForm } from '../features/lorawan/GatewaySetupForm';
import { SetupProgress } from '../features/lorawan/SetupProgress';
import { useGatewaySetup } from '../features/lorawan/hooks/useGatewaySetup';

/**
 * The LoRaWAN gateway screen.
 *
 * Three states, each with exactly one primary action:
 *   A. no concentrator  -> explain what hardware is needed
 *   B. detected         -> register with Chirp
 *   C. connected        -> status
 *
 * Contract 5: a view. Every decision lives in useGatewaySetup.
 */
export const Lorawan = memo(() => {
  const {
    concentrator,
    isDetecting,
    name,
    region,
    regions,
    step,
    errorMessage,
    technicalDetail,
    isBusy,
    handleNameChange,
    handleRegionChange,
    handleRegister,
  } = useGatewaySetup();

  return (
    <PageLayout title='LoRaWAN Gateway' subtitle='Connect this device to Chirp as a LoRaWAN gateway.'>
      {!concentrator && !isDetecting ? (
        <EmptyState title={CAPABILITY_COPY.lorawan.emptyTitle} />
      ) : null}

      {concentrator ? (
        <Stack sx={{ gap: LAYOUT.pageGap, maxWidth: LAYOUT.formMaxWidth }}>
          <ConcentratorDetails concentrator={concentrator} />

          {step === 'done' ? null : (
            <GatewaySetupForm
              name={name}
              region={region}
              regions={regions}
              isBusy={isBusy}
              onNameChange={handleNameChange}
              onRegionChange={handleRegionChange}
              onSubmit={handleRegister}
            />
          )}

          <SetupProgress step={step} errorMessage={errorMessage} technicalDetail={technicalDetail} />
        </Stack>
      ) : null}
    </PageLayout>
  );
});
