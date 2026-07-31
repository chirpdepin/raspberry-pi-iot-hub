import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './app/AppShell';
import { NAV_ITEMS, type CapabilityKey } from './config/navigation';
import { CapabilityPage } from './pages/CapabilityPage';
import { Dashboard } from './pages/Dashboard';
import { PagePlaceholder } from './pages/PagePlaceholder';
import { ThemeModeProvider } from './theme/ThemeModeContext';
import './i18n';

/**
 * HashRouter, not BrowserRouter: the packaged app loads from file://, where
 * path-based routing has no server to resolve against and a refresh 404s.
 *
 * Routes are generated from the navigation registry (Contract 1 O), so adding a
 * section never means editing this file.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Individual queries set their own polling. Refetching merely because a
      // window regained focus is wrong on a kiosk that never loses it.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const hasCapability = (
  item: (typeof NAV_ITEMS)[number]
): item is (typeof NAV_ITEMS)[number] & {
  capability: CapabilityKey;
} => Boolean(item.capability);

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeModeProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path='/' element={<Dashboard />} />

            {NAV_ITEMS.filter(hasCapability).map((item) => (
              <Route key={item.id} path={item.path} element={<CapabilityPage item={item} />} />
            ))}

            {NAV_ITEMS.filter((item) => !item.capability && item.path !== '/').map((item) => (
              <Route key={item.id} path={item.path} element={<PagePlaceholder item={item} />} />
            ))}

            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </ThemeModeProvider>
  </QueryClientProvider>
);
