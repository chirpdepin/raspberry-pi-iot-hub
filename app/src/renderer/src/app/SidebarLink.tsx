import type { MouseEvent, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Box } from '@mui/material';

import { LAYOUT } from '../config/defaults';

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
 * behaviour while restoring the expected appearance.
 *
 * **This box carries the row metrics**, matching chirp's styled link. That is
 * not cosmetic: the row height and the selected highlight are both this
 * element, so with no padding or min-height the row collapsed to text height
 * (20px against chirp's ~44px) and the highlight collapsed into a thin band
 * with it. Colour still comes from the theme and the active state from the
 * kit's surrounding ListItem (Contract 4).
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
  // Collapsed, the kit renders the icon alone and it should sit centred in the
  // rail; expanded, the label follows the icon.
  justifyContent: 'flex-start',
  width: '100%',
  flexGrow: 1,
  minHeight: LAYOUT.sidebarRowMinHeight,
  padding: LAYOUT.sidebarRowPadding,
  borderRadius: LAYOUT.sidebarRowRadius,
  boxSizing: 'border-box',
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
