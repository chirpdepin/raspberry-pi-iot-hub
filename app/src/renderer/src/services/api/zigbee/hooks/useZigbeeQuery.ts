import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { POLL } from '../../../../config/defaults';
import { zigbeeApi } from '../api';

/** Cache layer — TanStack Query wrappers and cache keys (Contract 5). */

export const zigbeeQueryKeys = {
  all: ['zigbee'] as const,
  coordinator: () => [...zigbeeQueryKeys.all, 'coordinator'] as const,
  devices: () => [...zigbeeQueryKeys.all, 'devices'] as const,
};

export const useZigbeeCoordinatorQuery = () =>
  useQuery({
    queryKey: zigbeeQueryKeys.coordinator(),
    queryFn: zigbeeApi.coordinator,
    refetchInterval: POLL.hostMs,
  });

export const useZigbeeDevicesQuery = (enabled: boolean) =>
  useQuery({
    queryKey: zigbeeQueryKeys.devices(),
    queryFn: zigbeeApi.devices,
    enabled,
    // Devices appear live during a join window, so this polls faster than the
    // hardware inventory does.
    refetchInterval: POLL.zigbeeDevicesMs,
  });

export const useStartZigbeeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: zigbeeApi.start,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: zigbeeQueryKeys.all }),
  });
};

export const usePermitJoinMutation = () => useMutation({ mutationFn: zigbeeApi.permitJoin });
export const useStopJoinMutation = () => useMutation({ mutationFn: zigbeeApi.stopJoin });

export const useLinkDeviceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: zigbeeApi.link,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: zigbeeQueryKeys.devices() }),
  });
};
