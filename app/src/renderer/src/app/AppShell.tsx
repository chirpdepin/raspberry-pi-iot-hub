import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import { BaseLayout } from '@chirpwireless/ui-kit/layouts';
import { Header, Sidebar } from '@chirpwireless/ui-kit/shell';
import type { SidebarItem } from '@chirpwireless/ui-kit/shell';

import { NAV_ITEMS } from '../config/navigation';
import { SidebarLink } from './SidebarLink';
import { ThemeToggle } from './ThemeToggle';
import { useResponsiveLayout } from './useResponsiveLayout';

/**
 * The application shell.
 *
 * Uses the kit's `BaseLayout` rather than a hand-rolled flex row, because the
 * Sidebar is a **fixed-position** MUI Drawer: it is taken out of normal flow, so
 * content must be offset by the sidebar width. `BaseLayout`'s AppContainer does
 * that offsetting and gets the breakpoint behaviour right. Laying it out by hand
 * puts the content underneath the drawer.
 *
 * Contract 3 (portability): correct fullscreen with no window chrome. On a
 * 1024×600 Pi touchscreen the kit treats the viewport as mobile, so the sidebar
 * overlays and the header supplies the toggle — the app never depends on a
 * window title bar or menu bar, which is what makes the future Ubuntu Frame
 * (Wayland kiosk) target a packaging change rather than a UI change.
 *
 * Contract 1 (S): this component arranges and decides nothing. Which sections
 * exist comes from the navigation registry; what each does lives in its page.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isMobile, isSidebarOpen, openSidebar, closeSidebar } = useResponsiveLayout();

  const groups = useMemo<SidebarItem[][]>(() => {
    const toItem = (item: (typeof NAV_ITEMS)[number]): SidebarItem => ({
      id: item.id,
      name: t(item.label),
      href: item.path,
      // Exact for the dashboard, prefix for the rest, so /cameras/add keeps
      // Cameras highlighted.
      match: item.path === '/' ? /^\/$/ : new RegExp(`^${item.path}`),
    });

    // Two groups so the kit draws a divider before Settings, separating
    // "things you set up" from "how the app itself behaves".
    return [
      NAV_ITEMS.filter((item) => item.id !== 'settings').map(toItem),
      NAV_ITEMS.filter((item) => item.id === 'settings').map(toItem),
    ];
  }, [t]);

  return (
    <BaseLayout
      isSidebarOpen={isSidebarOpen}
      isSidebarCollapsed={false}
      header={<Header onMenuOpen={openSidebar} showMenuButton />}
      sidebar={
        <Sidebar
          groups={groups}
          isOpen={isSidebarOpen}
          isCollapsed={false}
          isMobile={isMobile}
          onCollapseToggle={closeSidebar}
          activePathname={location.pathname}
          linkComponent={SidebarLink}
          // On a small screen the sidebar covers the content, so
          // choosing a destination must also dismiss it — otherwise the
          // user taps a link and appears to go nowhere.
          onItemClick={() => {
            if (isMobile) closeSidebar();
          }}
          bottomSlot={<ThemeToggle />}
        />
      }
    >
      <Box
        component='main'
        sx={(theme) => ({
          flex: 1,
          minWidth: 0,
          // Contract 4: spacing from the theme scale (base 4), never raw px.
          padding: theme.spacing(6),
          overflowY: 'auto',
        })}
      >
        {children}
      </Box>
    </BaseLayout>
  );
};
