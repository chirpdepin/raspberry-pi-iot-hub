import { useCallback, useState } from 'react';

import type { CameraPayload, DiscoveredCameraPayload } from '@shared/ipc';

import {
  useAddCameraMutation,
  useCameraAvailabilityQuery,
  useCamerasQuery,
  useCapacityQuery,
  useDiscoverCamerasMutation,
  useOpenCameraMutation,
  useRemoveCameraMutation,
} from '../../../services/api/cameras/hooks/useCamerasQuery';

/**
 * Business layer for the camera screens (Contract 5).
 *
 * **There is no wizard any more, and that is the point.** It used to run five
 * steps — scan, credentials, frame preview, recording mode and retention,
 * create — and four of them asked for settings the Twin asks for again in its
 * own UI. The flow is now: scan, pick a camera, and its Twin opens. Everything
 * about the camera is configured there, once, in the tool that owns it.
 */
export const useCameras = () => {
  const camerasQuery = useCamerasQuery();
  const capacityQuery = useCapacityQuery();
  const availabilityQuery = useCameraAvailabilityQuery();

  const discoverMutation = useDiscoverCamerasMutation();
  const addMutation = useAddCameraMutation();
  const removeMutation = useRemoveCameraMutation();
  const openMutation = useOpenCameraMutation();

  const [discovered, setDiscovered] = useState<DiscoveredCameraPayload[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<CameraPayload | null>(null);

  const handleScan = useCallback(async () => {
    setErrorMessage(null);
    const result = await discoverMutation.mutateAsync();

    // A failed scan must say so. Falling through to an empty list is what made
    // a scan that never ran look like a network with no cameras.
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setDiscovered(result.value);
  }, [discoverMutation]);

  const handleOpen = useCallback(
    async (id: string) => {
      const result = await openMutation.mutateAsync(id);
      if (!result.ok) setErrorMessage(result.error.message);
    },
    [openMutation]
  );

  /**
   * Picking a camera is the whole of setup: its Twin is created and opened.
   *
   * The first-login password is surfaced rather than hidden — the Twin forces a
   * change at first login, and it is the only way in until the user has set
   * their own (Contract 2 rules 5 and 6).
   */
  const handleSetUp = useCallback(
    async (camera: DiscoveredCameraPayload) => {
      setErrorMessage(null);

      if (camera.alreadyAdded) {
        const existing = camerasQuery.data?.find((entry) => entry.address === camera.address);
        if (existing) await handleOpen(existing.id);
        return;
      }

      setBusyAddress(camera.address);
      const result = await addMutation.mutateAsync(camera);
      setBusyAddress(null);

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setJustAdded(result.value.camera);
    },
    [addMutation, camerasQuery.data, handleOpen]
  );

  const handleRemove = useCallback(
    async (id: string, keepRecordings: boolean) => {
      const result = await removeMutation.mutateAsync({ id, keepRecordings });
      if (!result.ok) setErrorMessage(result.error.message);
    },
    [removeMutation]
  );

  const dismissJustAdded = useCallback(() => setJustAdded(null), []);
  const clearScan = useCallback(() => {
    setDiscovered(null);
    setErrorMessage(null);
  }, []);

  return {
    cameras: camerasQuery.data ?? [],
    capacity: capacityQuery.data ?? null,
    availability: availabilityQuery.data ?? null,
    discovered,
    isScanning: discoverMutation.isPending,
    busyAddress,
    justAdded,
    errorMessage,
    handleScan,
    clearScan,
    handleSetUp,
    handleOpen,
    handleRemove,
    dismissJustAdded,
  };
};
