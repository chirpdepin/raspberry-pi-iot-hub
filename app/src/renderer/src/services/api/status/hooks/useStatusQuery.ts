import { useQuery } from '@tanstack/react-query';

import { POLL } from '../../../../config/defaults';
import { statusApi } from '../api';

/** Cache layer — TanStack Query wrappers and cache keys (Contract 5). */

export const statusQueryKeys = {
  all: ['status'] as const,
  subsystems: () => [...statusQueryKeys.all, 'subsystems'] as const,
};

export const useSubsystemStatusQuery = () =>
  useQuery({
    queryKey: statusQueryKeys.subsystems(),
    queryFn: statusApi.subsystems,
    refetchInterval: POLL.hostMs,
  });
