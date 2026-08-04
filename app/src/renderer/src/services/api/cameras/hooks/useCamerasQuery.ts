import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { POLL } from '../../../../config/defaults';
import { camerasApi } from '../api';

/** Cache layer — TanStack Query wrappers and cache keys (Contract 5). */

export const cameraQueryKeys = {
  all: ['cameras'] as const,
  list: () => [...cameraQueryKeys.all, 'list'] as const,
  capacity: () => [...cameraQueryKeys.all, 'capacity'] as const,
  pending: () => [...cameraQueryKeys.all, 'pending'] as const,
};

export const useCamerasQuery = () =>
  useQuery({
    queryKey: cameraQueryKeys.list(),
    queryFn: camerasApi.list,
    // A camera that stops recording is the failure this list exists to show, so
    // it is polled rather than left until the user navigates away and back.
    refetchInterval: POLL.dockerMs,
  });

export const useCapacityQuery = () =>
  useQuery({ queryKey: cameraQueryKeys.capacity(), queryFn: camerasApi.capacity });

/**
 * Discovery is a mutation, not a query: a full subnet sweep takes ten seconds
 * and must run when the user presses Scan, never on mount or on a timer.
 */
export const useDiscoverCamerasMutation = () => useMutation({ mutationFn: camerasApi.discover });


export const useAddCameraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: camerasApi.add,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cameraQueryKeys.all }),
  });
};

/** Opening a camera changes nothing, so there is no cache to invalidate. */
export const useOpenCameraMutation = () => useMutation({ mutationFn: camerasApi.open });

export const useRemoveCameraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: camerasApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cameraQueryKeys.all }),
  });
};

/**
 * The camera request waiting on Docker.
 *
 * Polled, because it is finished by the **main process** while the user is away
 * installing Docker — there is no click to invalidate this cache. The interval
 * is the same one the waiting screen implies is happening.
 */
export const usePendingCameraQuery = () =>
  useQuery({
    queryKey: cameraQueryKeys.pending(),
    queryFn: camerasApi.pending,
    refetchInterval: POLL.pendingCameraMs,
  });

export const useCancelPendingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: camerasApi.cancelPending,
    onSettled: () => queryClient.invalidateQueries({ queryKey: cameraQueryKeys.all }),
  });
};

export const useAcknowledgePendingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: camerasApi.acknowledgePending,
    onSettled: () => queryClient.invalidateQueries({ queryKey: cameraQueryKeys.all }),
  });
};
