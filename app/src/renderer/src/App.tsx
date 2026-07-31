import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeModeProvider } from './theme/ThemeModeContext';
import { AppShell } from './app/AppShell';
import { PagePlaceholder } from './pages/PagePlaceholder';
import { NAV_ITEMS } from './config/navigation';
import './i18n';

/**
 * HashRouter, not BrowserRouter: the packaged app is loaded from file://, where
 * path-based routing has no server to resolve against and a refresh would 404.
 *
 * Routes are generated from the navigation registry (Contract 1 O) so adding a
 * section never means editing this file.
 */

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Hardware and container state is polled deliberately by the screens
            // that need it; nothing should refetch merely because a window
            // regained focus on a kiosk that never loses it.
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export const App = () => (
    <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
            <HashRouter>
                <AppShell>
                    <Routes>
                        {NAV_ITEMS.map((item) => (
                            <Route
                                key={item.id}
                                path={item.path}
                                element={<PagePlaceholder section={item.id} />}
                            />
                        ))}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AppShell>
            </HashRouter>
        </ThemeModeProvider>
    </QueryClientProvider>
);
