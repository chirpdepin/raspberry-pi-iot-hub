import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { NAV_ITEMS, type CapabilityKey } from '../../../config/navigation';
import {
  useAppInfoQuery,
  useDockerStatusQuery,
  useHostDetailsQuery,
  useInstallDockerMutation,
  useSystemLoadQuery,
} from '../../../services/api/host/hooks/useHostDetailsQuery';
import { useSubsystemStatusQuery } from '../../../services/api/status/hooks/useStatusQuery';

/**
 * Business layer for the dashboard.
 *
 * Contract 5: the page component calls only this. It never touches TanStack
 * Query or the IPC transport, so the view stays a rendering concern and this
 * stays the only place dashboard policy lives.
 */

export interface AttentionItem {
  id: string;
  /** English text used as the i18n key. */
  message: string;
  /** English text used as the i18n key. */
  actionLabel: string;
  onAction: () => void;
}

export interface CapabilityCard {
  key: CapabilityKey;
  /** English text used as the i18n key. */
  label: string;
  available: boolean;
  /** English text used as the i18n key, present only when unavailable. */
  reason?: string;
  path: string;
}

export const useDashboard = () => {
  const hostQuery = useHostDetailsQuery();
  const appInfoQuery = useAppInfoQuery();
  const dockerQuery = useDockerStatusQuery();
  const systemLoadQuery = useSystemLoadQuery();
  const subsystemQuery = useSubsystemStatusQuery();
  const installDocker = useInstallDockerMutation();
  const navigate = useNavigate();

  // useCallback so the attention items below have a stable dependency; without
  // it the memo rebuilds on every render and the lint rule is right to object.
  const handleInstallDocker = useCallback(() => installDocker.mutate(), [installDocker]);

  const cards = useMemo<CapabilityCard[]>(() => {
    const capabilities = hostQuery.data?.capabilities;

    return NAV_ITEMS.filter((item): item is typeof item & { capability: CapabilityKey } =>
      Boolean(item.capability)
    ).map((item) => ({
      key: item.capability,
      label: item.label,
      available: capabilities?.[item.capability]?.available ?? false,
      reason: capabilities?.[item.capability]?.reason,
      path: item.path,
    }));
  }, [hostQuery.data]);

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const docker = dockerQuery.data;

    // Only surface Docker when it is genuinely actionable. A laptop with no
    // radios is not a problem and must not appear here — the "needs attention"
    // strip loses all meaning if it lists things that are working as intended.
    if (docker && !docker.installed) {
      items.push({
        id: 'docker-missing',
        message: 'Camera recording needs Docker.',
        actionLabel: 'Install Docker',
        onAction: handleInstallDocker,
      });
    } else if (docker && !docker.running) {
      items.push({
        id: 'docker-stopped',
        message: 'Docker is installed but not running.',
        actionLabel: 'Start Docker',
        onAction: handleInstallDocker,
      });
    }

    /**
     * One row per failing subsystem, and only failing ones.
     *
     * The status list is gathered so that one broken subsystem cannot suppress
     * the others, which is what makes it safe to render them all here: pulling
     * the Zigbee dongle adds a Zigbee row and changes nothing else.
     */
    for (const subsystem of subsystemQuery.data ?? []) {
      if (subsystem.state !== 'failed' || !subsystem.nextAction) continue;

      const { label, route } = subsystem.nextAction;

      items.push({
        id: `subsystem-${subsystem.id}`,
        message: subsystem.summary,
        actionLabel: label,
        onAction: () => navigate(route),
      });
    }

    return items;
  }, [dockerQuery.data, handleInstallDocker, subsystemQuery.data, navigate]);

  const isNothingConfigured = cards.every((card) => !card.available);

  return {
    host: hostQuery.data?.host,
    appInfo: appInfoQuery.data,
    docker: dockerQuery.data,
    load: systemLoadQuery.data,
    cards,
    subsystems: subsystemQuery.data ?? [],
    attention,
    isNothingConfigured,
    isLoading: hostQuery.isLoading,
    handleInstallDocker,
  };
};
