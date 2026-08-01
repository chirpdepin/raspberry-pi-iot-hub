import { useCallback, useEffect, useMemo, useState } from 'react';

import { JOIN_WINDOW_SECONDS } from '../../../config/defaults';
import {
  useLinkDeviceMutation,
  usePermitJoinMutation,
  useStartZigbeeMutation,
  useStopJoinMutation,
  useZigbeeCoordinatorQuery,
  useZigbeeDevicesQuery,
} from '../../../services/api/zigbee/hooks/useZigbeeQuery';

/**
 * Business layer for the Zigbee screen.
 *
 * Contract 5: the page renders what this returns. The join countdown lives here
 * because it is a domain rule — the window is bounded so a forgotten open
 * network is not a security problem — not a layout concern.
 */
export const useZigbee = (gatewayEui: string | null, hubName: string) => {
  const coordinatorQuery = useZigbeeCoordinatorQuery();
  const coordinator = coordinatorQuery.data ?? null;

  const devicesQuery = useZigbeeDevicesQuery(Boolean(coordinator));
  const startMutation = useStartZigbeeMutation();
  const permitJoinMutation = usePermitJoinMutation();
  const stopJoinMutation = useStopJoinMutation();
  const linkMutation = useLinkDeviceMutation();

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);

  const handleStart = useCallback(async () => {
    setErrorMessage(null);
    const result = await startMutation.mutateAsync(undefined);
    if (!result.ok) setErrorMessage(result.error.message);
  }, [startMutation]);

  const handleAddDevice = useCallback(async () => {
    setErrorMessage(null);
    const result = await permitJoinMutation.mutateAsync(JOIN_WINDOW_SECONDS);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setSecondsRemaining(JOIN_WINDOW_SECONDS);
  }, [permitJoinMutation]);

  const handleStopJoin = useCallback(async () => {
    await stopJoinMutation.mutateAsync();
    setSecondsRemaining(0);
  }, [stopJoinMutation]);

  const handleLinkDevice = useCallback(
    async (ieeeAddress: string, displayName: string) => {
      if (!gatewayEui) {
        // Without a gateway EUI the MQTT topic prefix has nothing unique in it,
        // and two hubs on one Chirp account would collide.
        setErrorMessage('Set up the LoRaWAN gateway first so this hub has an identifier.');
        return;
      }

      setErrorMessage(null);
      const result = await linkMutation.mutateAsync({ ieeeAddress, displayName, gatewayEui, hubName });
      if (!result.ok) setErrorMessage(result.error.message);
    },
    [gatewayEui, hubName, linkMutation]
  );

  // The only genuine external synchronisation here: a wall-clock countdown that
  // must keep ticking without a user interaction to hang it off.
  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  return {
    coordinator,
    isDetecting: coordinatorQuery.isLoading,
    devices,
    isJoining: secondsRemaining > 0,
    secondsRemaining,
    errorMessage,
    isStarting: startMutation.isPending,
    handleStart,
    handleAddDevice,
    handleStopJoin,
    handleLinkDevice,
  };
};
