import type { MouseEvent, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Box } from '@mui/material';

/**
 * The link component injected into the ui-kit `Sidebar`.
 *
 * The kit's default renders a plain `<a href>`, which under file:// triggers a
 * full page navigation and blanks the app. `Sidebar` exposes `linkComponent`
 * precisely as the seam for replacing it, so no kit code is patched.
 *
 * The kit styles its own link through an internal `LinkBox` that is not
 * exported, so a bare `NavLink` arrives unstyled and browser-default underlined.
 * Rendering through MUI's `Box` with `component={NavLink}` keeps router
 * behaviour while restoring the expected appearance. Only structural properties
 * are set here — colour and spacing still come from the theme and from the kit's
 * surrounding ListItem, which owns the active state (Contract 4).
 *
 * External links are not navigated here at all: main's window-open handler sends
 * them to the user's own browser, so they never trap the user inside a
 * chrome-less window they cannot navigate back out of (Contract 2 rule 6).
 */
export interface SidebarLinkProps {
  href: string;
  isExternal?: boolean;
  isActive?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
  className?: string;
}

const linkSx = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  textDecoration: 'none',
  color: 'inherit',
} as const;

export const SidebarLink = ({ href, isExternal, disabled, onClick, children, className }: SidebarLinkProps) => {
  if (isExternal) {
    return (
      <Box component='a' href={href} target='_blank' rel='noopener noreferrer' className={className} sx={linkSx}>
        {children}
      </Box>
    );
  }

  return (
    <Box
      component={NavLink}
      to={href}
      className={className}
      sx={linkSx}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </Box>
  );
};
