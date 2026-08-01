import { useCallback, useState } from 'react';

import type { CameraPayload, CameraScanPayload, DiscoveredCameraPayload } from '@shared/ipc';

import {
  useAddCameraMutation,
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
 *
 * **Scanning is optional.** It finds only cameras that advertise themselves, so
 * `[Add camera]` starts a Twin with no camera attached and the user gives it an
 * address in the Twin. A found camera is a shortcut, not the way in.
 */

/**
 * Sentinel for "a camera is being set up that has no address" — the blank add.
 * A row keyed by address cannot represent it, and `null` already means idle.
 */
export const BLANK_ADD = '__blank__';

export const useCameras = () => {
  const camerasQuery = useCamerasQuery();
  const capacityQuery = useCapacityQuery();

  const discoverMutation = useDiscoverCamerasMutation();
  const addMutation = useAddCameraMutation();
  const removeMutation = useRemoveCameraMutation();
  const openMutation = useOpenCameraMutation();

  const [scan, setScan] = useState<CameraScanPayload | null>(null);
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

    setScan(result.value);
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
    setScan(null);
    setErrorMessage(null);
  }, []);

  /**
   * Setting up a camera we never found. The main route, not a fallback: a scan
   * only ever finds cameras that advertise themselves, so most of someone's
   * cameras will never appear in one.
   */
  const handleAddBlank = useCallback(async () => {
    setErrorMessage(null);
    setBusyAddress(BLANK_ADD);

    const result = await addMutation.mutateAsync(undefined);
    setBusyAddress(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setJustAdded(result.value.camera);
  }, [addMutation]);

  return {
    cameras: camerasQuery.data ?? [],
    capacity: capacityQuery.data ?? null,
    scan,
    isScanning: discoverMutation.isPending,
    busyAddress,
    justAdded,
    errorMessage,
    handleScan,
    clearScan,
    handleSetUp,
    handleAddBlank,
    handleOpen,
    handleRemove,
    dismissJustAdded,
  };
};
