import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { POLL } from '../../../../config/defaults';
import { hostApi } from '../api';

/**
 * Cache layer — TanStack Query wrappers and cache keys.
 *
 * Contract 5: components never call `useQuery` directly, and never call the API
 * layer directly. They call a business hook, which calls these.
 */

export const hostQueryKeys = {
  all: ['host'] as const,
  details: () => [...hostQueryKeys.all, 'details'] as const,
  appInfo: () => [...hostQueryKeys.all, 'appInfo'] as const,
  docker: () => [...hostQueryKeys.all, 'docker'] as const,
};

export const useHostDetailsQuery = () =>
  useQuery({
    queryKey: hostQueryKeys.details(),
    queryFn: hostApi.getHostDetails,
    // Hardware changes while the app is open — a dongle gets plugged in — so
    // this polls rather than caching indefinitely.
    refetchInterval: POLL.hostMs,
  });

export const useAppInfoQuery = () =>
  useQuery({
    queryKey: hostQueryKeys.appInfo(),
    queryFn: hostApi.getAppInfo,
    // Version and platform cannot change while the process is running.
    staleTime: Infinity,
  });

export const useDockerStatusQuery = () =>
  useQuery({
    queryKey: hostQueryKeys.docker(),
    queryFn: hostApi.getDockerStatus,
    refetchInterval: POLL.dockerMs,
  });

export const useInstallDockerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hostApi.installDocker,
    // The installer runs outside the app, so the only sane thing to do on
    // return is re-check rather than assume success.
    onSettled: () => queryClient.invalidateQueries({ queryKey: hostQueryKeys.all }),
  });
};
