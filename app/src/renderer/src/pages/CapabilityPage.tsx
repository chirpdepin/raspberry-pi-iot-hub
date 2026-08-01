import { memo } from 'react';

import { CAPABILITY_COPY } from '../config/capabilities';
import type { CapabilityKey, NavItem } from '../config/navigation';
import { EmptyState } from '../features/common/EmptyState';
import { PageLayout } from '../features/common/PageLayout';
import { useHostDetailsQuery } from '../services/api/host/hooks/useHostDetailsQuery';

interface CapabilityPageProps {
  item: NavItem & { capability: CapabilityKey };
}

/**
 * Shared shell for the four hardware-backed sections until each grows its real
 * content in Phases 5, 6 and 8.
 *
 * Contract 1 (O): the empty-state copy comes from the capability registry, so
 * adding a capability means adding a registry row — not editing a `switch` here.
 *
 * Contract 2 rule 4: the unavailable case explains *why* and points at hardware
 * guidance, rather than hiding the section. The reason string comes from the
 * main process, which knows whether Docker is missing or merely stopped.
 */
export const CapabilityPage = memo<CapabilityPageProps>(({ item }) => {
  const { data } = useHostDetailsQuery();

  const capability = data?.capabilities?.[item.capability];
  const copy = CAPABILITY_COPY[item.capability];
  const isAvailable = capability?.available ?? false;

  return (
    <PageLayout title={item.label} subtitle={item.subtitle}>
      {isAvailable ? (
        <EmptyState title={copy.unconfiguredTitle} />
      ) : (
        <EmptyState
          // Prefer the reason the main process computed — it distinguishes
          // "Docker missing" from "Docker stopped", which the static registry
          // copy cannot.
          title={capability?.reason ?? copy.emptyTitle}
        />
      )}
    </PageLayout>
  );
});
