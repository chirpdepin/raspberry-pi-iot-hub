import type { SVGProps } from 'react';

/**
 * The leading icon on Chirp's page-header action buttons, copied from
 * `chirp-frontend/src/assets/icons/PlusIcon`.
 *
 * The ui-kit ships no generic plus icon (only `PhotoPlusIcon`), which is why
 * chirp-frontend keeps its own and why this is copied rather than imported.
 * `currentColor` on the strokes, so it follows the button's own colour.
 */
export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
    <path d='M6 0.642578V11.3569' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
    <path d='M11.3569 6H0.642578' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);
