import { useCallback, useState } from 'react';

import type { CameraPayload, CameraScanPayload, DiscoveredCameraPayload } from '@shared/ipc';

import {
  useAcknowledgePendingMutation,
  useAddCameraMutation,
  useCamerasQuery,
  useCancelPendingMutation,
  useCapacityQuery,
  useDiscoverCamerasMutation,
  useOpenCameraMutation,
  usePendingCameraQuery,
  useRemoveCameraMutation,
} from '../../../services/api/cameras/hooks/useCamerasQuery';
import { useDockerStatusQuery, useInstallDockerMutation } from '../../../services/api/host/hooks/useHostDetailsQuery';

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

  const dockerQuery = useDockerStatusQuery();
  const pendingQuery = usePendingCameraQuery();
  const installDocker = useInstallDockerMutation();
  const cancelPending = useCancelPendingMutation();
  const acknowledgePending = useAcknowledgePendingMutation();

  const discoverMutation = useDiscoverCamerasMutation();
  const addMutation = useAddCameraMutation();
  const removeMutation = useRemoveCameraMutation();
  const openMutation = useOpenCameraMutation();

  const [scan, setScan] = useState<CameraScanPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<CameraPayload | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<CameraPayload | null>(null);
  /** The camera the user asked for while Docker was missing, held until they confirm the install. */
  const [awaitingConsent, setAwaitingConsent] = useState<DiscoveredCameraPayload | null | undefined>(undefined);

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

      // Same route as the blank add: a scan result is a shortcut into setup, and
      // setup still needs Docker.
      if (dockerQuery.data && dockerQuery.data.state !== 'ready') {
        setAwaitingConsent(camera);
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
    [addMutation, camerasQuery.data, dockerQuery.data, handleOpen]
  );

  /**
   * Removing is a two-step: ask, then do.
   *
   * The camera's recordings outlive the camera unless the user says otherwise,
   * and until this existed the screen never asked — it always kept them, so the
   * data was orphaned where nothing could reach it and the disk filled with
   * volumes belonging to cameras that no longer appeared anywhere. Deleting a
   * container is reversible in a minute; deleting recordings is not, so the two
   * are separate answers to a question the user is actually asked.
   */
  const requestRemove = useCallback((camera: CameraPayload) => {
    setErrorMessage(null);
    setPendingRemoval(camera);
  }, []);

  const cancelRemove = useCallback(() => setPendingRemoval(null), []);

  const confirmRemove = useCallback(
    async (keepRecordings: boolean) => {
      const camera = pendingRemoval;
      if (!camera) return;

      setPendingRemoval(null);
      const result = await removeMutation.mutateAsync({ id: camera.id, keepRecordings });
      if (!result.ok) setErrorMessage(result.error.message);
    },
    [pendingRemoval, removeMutation]
  );

  /**
   * The camera to show first-login details for.
   *
   * Either one added just now in this window, **or one main finished while the
   * user was away installing Docker**. The second case is why this is not plain
   * local state: that camera was created by the resume, so nothing in the
   * renderer ever saw its credentials — and the Twin forces a password change at
   * first login, making them the only way in. Dropping them would lock the user
   * out of their own camera.
   */
  const readyCamera = justAdded ?? (pendingQuery.data?.state === 'done' ? (pendingQuery.data.camera ?? null) : null);

  const dismissJustAdded = useCallback(async () => {
    setJustAdded(null);
    // Also clears the finished job, so the notice does not return on the next poll.
    if (pendingQuery.data?.state === 'done') await acknowledgePending.mutateAsync();
  }, [acknowledgePending, pendingQuery.data]);
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

    // Docker missing is not a reason to refuse the click — it is the reason the
    // user needs help. Asking for consent here is what turns a greyed-out button
    // into the way in.
    if (dockerQuery.data && dockerQuery.data.state !== 'ready') {
      setAwaitingConsent(null);
      return;
    }

    setBusyAddress(BLANK_ADD);
    const result = await addMutation.mutateAsync(undefined);
    setBusyAddress(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    setJustAdded(result.value.camera);
  }, [addMutation, dockerQuery.data]);

  /**
   * The user accepted: record the request, then hand over to Docker's installer.
   *
   * The job is written by main **before** the installer opens, so an installer
   * that triggers a reboot cannot lose what the user asked for.
   */
  const handleInstallDocker = useCallback(async () => {
    const camera = awaitingConsent;
    setAwaitingConsent(undefined);
    setErrorMessage(null);

    const result = await installDocker.mutateAsync(camera ?? undefined);
    if (!result.ok) setErrorMessage(result.error.message);
  }, [awaitingConsent, installDocker]);

  const dismissConsent = useCallback(() => setAwaitingConsent(undefined), []);

  const handleCancelPending = useCallback(async () => {
    await cancelPending.mutateAsync();
  }, [cancelPending]);

  const dismissPending = useCallback(async () => {
    await acknowledgePending.mutateAsync();
  }, [acknowledgePending]);

  return {
    cameras: camerasQuery.data ?? [],
    docker: dockerQuery.data,
    pending: pendingQuery.data ?? null,
    awaitingConsent,
    handleInstallDocker,
    dismissConsent,
    handleCancelPending,
    dismissPending,
    capacity: capacityQuery.data ?? null,
    scan,
    isScanning: discoverMutation.isPending,
    busyAddress,
    justAdded: readyCamera,
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
  };
};
