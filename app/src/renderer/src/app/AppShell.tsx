import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Divider, Stack } from '@mui/material';
import { BaseLayout } from '@chirpwireless/ui-kit/layouts';
import { Header, Sidebar } from '@chirpwireless/ui-kit/shell';
import type { SidebarItem } from '@chirpwireless/ui-kit/shell';

import { ChirpLogo } from '../assets/chirp/ChirpLogo';
import { ChirpMark } from '../assets/chirp/ChirpMark';
import { LAYOUT } from '../config/defaults';
import { NAV_ITEMS } from '../config/navigation';
import { LanguageSelector } from './LanguageSelector';
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
 * Composition mirrors `chirp-frontend/src/app/Sidebar/Sidebar.tsx`: logo and
 * collapsed mark, grouped items with icons, and a bottom slot holding the
 * language picker beside the theme switch above a divider.
 *
 * **`footerSlot` is deliberately absent.** chirp puts a `UserMenu` there; this
 * app has no sign-in yet, and an account row that cannot show an account would
 * be worse than none.
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
  const { isMobile, isSidebarOpen, openSidebar, closeSidebar, isSidebarCollapsed, toggleSidebarCollapsed } =
    useResponsiveLayout();

  const groups = useMemo<SidebarItem[][]>(() => {
    const toItem = (item: (typeof NAV_ITEMS)[number]): SidebarItem => ({
      id: item.id,
      name: t(item.label),
      href: item.path,
      // Carried through from the registry. Collapsed, this is all the kit has
      // to render — without it the rail shows clipped labels.
      icon: item.icon,
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

  const bottomSlot = (
    <>
      <Stack
        direction='row'
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          px: LAYOUT.sidebarRowPaddingX,
        }}
      >
        <LanguageSelector isCollapsed={isSidebarCollapsed} />
        {/* Collapsed there is no room for the label, and a bare switch with no
            word beside it reads as an unlabelled toggle. */}
        {isSidebarCollapsed ? null : <ThemeToggle />}
      </Stack>
      {isSidebarCollapsed ? null : <Divider sx={{ width: '100%', borderColor: 'borders.primary' }} />}
    </>
  );

  return (
    <BaseLayout
      isSidebarOpen={isSidebarOpen}
      isSidebarCollapsed={isSidebarCollapsed}
      header={<Header onMenuOpen={openSidebar} showMenuButton />}
      sidebar={
        <Sidebar
          groups={groups}
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          isMobile={isMobile}
          // Collapse narrows the rail; it does not dismiss the sidebar. Wiring
          // this to `closeSidebar` is what made collapse a one-way trip.
          onCollapseToggle={toggleSidebarCollapsed}
          activePathname={location.pathname}
          linkComponent={SidebarLink}
          logo={<ChirpLogo />}
          logoCollapsed={<ChirpMark width={20} height={20} />}
          bottomSlot={bottomSlot}
          // On a small screen the sidebar covers the content, so
          // choosing a destination must also dismiss it — otherwise the
          // user taps a link and appears to go nowhere.
          onItemClick={() => {
            if (isMobile) closeSidebar();
          }}
        />
      }
    >
      {/*
        No padding here. `PageWrapper` inside every page already supplies
        chirp's 24px; adding `theme.spacing(6)` on top made every screen 72px
        inset against chirp's 24px.
      */}
      <Box component='main' sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </Box>
    </BaseLayout>
  );
};
