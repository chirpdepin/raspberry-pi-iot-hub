import { useEffect, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Responsive sidebar state.
 *
 * Mirrors the ui-kit's own `useBreakpoints` definition of "mobile":
 * `down('md') || between('md','lg')` — i.e. **anything below the `lg`
 * breakpoint (1248px)**. That is wider than it sounds, and it matters here: a
 * 1024×600 Raspberry Pi touchscreen is "mobile" to the kit, so its Sidebar
 * deliberately becomes a full-screen overlay that must be toggled rather than a
 * permanent rail. Passing a permanently-open sidebar at that size covers the
 * entire screen and hides the content — which is exactly what happened before
 * this hook existed.
 *
 * The kit's `useLayout` is not used because it takes a static `defaultOpen` and
 * cannot react to a size change; and `useBreakpoints` itself is only exported
 * from the kit's root entry, which we must not import (it pulls `map-utils.ts`,
 * which reads `import.meta.env` and drags mapbox/turf into the bundle).
 */
export interface ResponsiveLayout {
  /** Below the kit's `lg` breakpoint — sidebar overlays and needs a toggle. */
  isMobile: boolean;
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
}

export const useResponsiveLayout = (): ResponsiveLayout => {
  const theme = useTheme();
  const isBelowMd = useMediaQuery(theme.breakpoints.down('md'));
  const isMdToLg = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isMobile = isBelowMd || isMdToLg;

  const [isSidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Follow the viewport: permanent on a desktop, closed by default on a small
  // screen so the user sees content rather than a full-screen menu.
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return {
    isMobile,
    isSidebarOpen,
    openSidebar: () => setSidebarOpen(true),
    closeSidebar: () => setSidebarOpen(false),
  };
};
