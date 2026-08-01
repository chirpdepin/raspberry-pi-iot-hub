import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { POLL } from '../../../../config/defaults';
import { camerasApi } from '../api';

/** Cache layer — TanStack Query wrappers and cache keys (Contract 5). */

export const cameraQueryKeys = {
  all: ['cameras'] as const,
  list: () => [...cameraQueryKeys.all, 'list'] as const,
  capacity: () => [...cameraQueryKeys.all, 'capacity'] as const,
  discovered: () => [...cameraQueryKeys.all, 'discovered'] as const,
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
 * Discovery is a mutation, not a query: it takes five seconds of multicast and
 * must run when the user presses Scan, never on mount or on a timer.
 */
export const useDiscoverCamerasMutation = () => useMutation({ mutationFn: camerasApi.discover });

export const useProbeCameraMutation = () => useMutation({ mutationFn: camerasApi.probe });

export const useAddCameraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: camerasApi.add,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cameraQueryKeys.all }),
  });
};

export const useRemoveCameraMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: camerasApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cameraQueryKeys.all }),
  });
};
