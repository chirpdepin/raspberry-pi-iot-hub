import { Box } from '@mui/material';
import { memo } from 'react';

import { LAYOUT } from '../config/defaults';
import { AttentionStrip } from '../features/dashboard/AttentionStrip';
import { CapabilityCard } from '../features/dashboard/CapabilityCard';
import { DeviceCard } from '../features/dashboard/DeviceCard';
import { useDashboard } from '../features/dashboard/hooks/useDashboard';
import { PageLayout } from '../features/common/PageLayout';

/**
 * The dashboard.
 *
 * Contract 5: a view. It renders what `useDashboard` gives it and holds no
 * policy of its own — no `useQuery`, no IPC, no decisions about what counts as
 * needing attention.
 */
export const Dashboard = memo(() => {
  const { host, appInfo, docker, load, cards, attention } = useDashboard();

  return (
    <PageLayout title='Dashboard'>
      <AttentionStrip items={attention} />

      <Box
          sx={{
            display: 'grid',
            gap: LAYOUT.cardGap,
            // auto-fill keeps two columns at the 1024px Pi touchscreen floor and
            // expands on a desktop, with no breakpoint list to maintain.
            gridTemplateColumns: `repeat(auto-fill, minmax(${LAYOUT.cardMinWidth}, 1fr))`,
          }}
        >
        <DeviceCard host={host} appInfo={appInfo} docker={docker} load={load} />

        {cards.map((card) => (
          <CapabilityCard key={card.key} card={card} />
        ))}
      </Box>
    </PageLayout>
  );
});
