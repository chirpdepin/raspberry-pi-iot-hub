import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { lorawanApi } from '../api';

/** Cache layer — TanStack Query wrappers and cache keys (Contract 5). */

export const gatewayQueryKeys = {
  all: ['gateway'] as const,
  concentrator: () => [...gatewayQueryKeys.all, 'concentrator'] as const,
};

export const useConcentratorQuery = () =>
  useQuery({
    queryKey: gatewayQueryKeys.concentrator(),
    queryFn: lorawanApi.detect,
  });

export const useRegisterGatewayMutation = () => useMutation({ mutationFn: lorawanApi.register });

export const useProvisionGatewayMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: lorawanApi.provision,
    // Provisioning starts the service, which changes host capability state.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['host'] }),
  });
};
