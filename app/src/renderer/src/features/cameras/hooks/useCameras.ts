import { useCallback, useState } from 'react';

import type { CameraConfigPayload, CameraProbePayload, DiscoveredCameraPayload } from '@shared/ipc';

import { CAMERA_DEFAULTS } from '../../../config/cameras';
import {
  useAddCameraMutation,
  useCamerasQuery,
  useCapacityQuery,
  useDiscoverCamerasMutation,
  useProbeCameraMutation,
  useRemoveCameraMutation,
} from '../../../services/api/cameras/hooks/useCamerasQuery';

/**
 * Business layer for the camera screens (Contract 5).
 *
 * Every decision lives here; the page renders what it is told. The wizard step
 * is state rather than a route because a half-configured camera is not
 * something a user should be able to bookmark or reach with the back button.
 */

export type WizardStep = 'discover' | 'connect' | 'preview' | 'settings' | 'done';

export const useCameras = () => {
  const camerasQuery = useCamerasQuery();
  const capacityQuery = useCapacityQuery();

  const discoverMutation = useDiscoverCamerasMutation();
  const probeMutation = useProbeCameraMutation();
  const addMutation = useAddCameraMutation();
  const removeMutation = useRemoveCameraMutation();

  const [step, setStep] = useState<WizardStep>('discover');
  const [selected, setSelected] = useState<DiscoveredCameraPayload | null>(null);
  const [config, setConfig] = useState<CameraConfigPayload | null>(null);
  const [frame, setFrame] = useState<CameraProbePayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('discover');
    setSelected(null);
    setConfig(null);
    setFrame(null);
    setErrorMessage(null);
  }, []);

  const handleScan = useCallback(async () => {
    setErrorMessage(null);
    await discoverMutation.mutateAsync();
  }, [discoverMutation]);

  /**
   * Choosing a camera pre-fills everything that can be inferred — the RTSP path
   * and ONVIF port from the vendor registry, the display name from the model
   * (Contract 2 rule 3). Only the password is genuinely unknowable.
   */
  const handleSelect = useCallback((camera: DiscoveredCameraPayload) => {
    setSelected(camera);
    setConfig({
      displayName: camera.model ?? camera.manufacturer ?? camera.address,
      address: camera.address,
      credentials: { username: CAMERA_DEFAULTS.username, password: '' },
      rtspPath: camera.suggestedRtspPath,
      onvifPort: camera.suggestedOnvifPort,
      recording: CAMERA_DEFAULTS.recording,
      retentionDays: CAMERA_DEFAULTS.retentionDays,
    });
    setStep('connect');
    setErrorMessage(null);
  }, []);

  const updateConfig = useCallback((patch: Partial<CameraConfigPayload>) => {
    setConfig((current) => (current ? { ...current, ...patch } : current));
  }, []);

  /**
   * Testing the connection is what produces the frame, and the frame is the
   * proof (Contract 2 rule 5). Nothing is created until the user has seen it.
   */
  const handleTestConnection = useCallback(async () => {
    if (!config) return;

    setErrorMessage(null);
    const result = await probeMutation.mutateAsync(config);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setFrame(result.value);
    setStep('preview');
  }, [config, probeMutation]);

  const handleAdd = useCallback(async () => {
    if (!config) return;

    setErrorMessage(null);
    const result = await addMutation.mutateAsync(config);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setStep('done');
  }, [config, addMutation]);

  const handleRemove = useCallback(
    async (id: string, keepRecordings: boolean) => {
      setErrorMessage(null);
      const result = await removeMutation.mutateAsync({ id, keepRecordings });

      if (!result.ok) setErrorMessage(result.error.message);
    },
    [removeMutation]
  );

  return {
    cameras: camerasQuery.data ?? [],
    capacity: capacityQuery.data ?? null,
    discovered: discoverMutation.data ?? [],
    isScanning: discoverMutation.isPending,
    isTesting: probeMutation.isPending,
    isAdding: addMutation.isPending,
    step,
    selected,
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
  };
};
