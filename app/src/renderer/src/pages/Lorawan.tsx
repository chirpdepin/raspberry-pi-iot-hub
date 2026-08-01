import { Stack } from '@mui/material';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CAPABILITY_COPY } from '../config/capabilities';
import { LAYOUT } from '../config/defaults';
import { EmptyState } from '../features/common/EmptyState';
import { PageAction } from '../features/common/PageAction';
import { PageLayout } from '../features/common/PageLayout';
import { DataTable } from '../features/common/DataTable';
import { gatewayColumns } from '../features/lorawan/columns';
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
  const { t } = useTranslation();

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

  const columns = useMemo(() => gatewayColumns(t), [t]);

  return (
    <PageLayout
      title='LoRaWAN Gateway'
      subtitle='Connect this device to Chirp as a LoRaWAN gateway.'
      actions={
        <PageAction
          label='Register with Chirp'
          showPlus={false}
          onClick={handleRegister}
          disabledReason={
            concentrator ? (isBusy ? 'Working…' : undefined) : 'This computer has no LoRaWAN concentrator.'
          }
        />
      }
    >
      {!concentrator && !isDetecting ? (
        <EmptyState title={CAPABILITY_COPY.lorawan.emptyTitle} />
      ) : null}

      {concentrator ? (
        <Stack sx={{ gap: LAYOUT.pageGap, maxWidth: LAYOUT.formMaxWidth }}>
          <DataTable heading='Gateway' data={[concentrator]} columns={columns} emptyTitle={CAPABILITY_COPY.lorawan.emptyTitle} />

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
