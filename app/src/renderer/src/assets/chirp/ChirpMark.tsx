import type { SVGProps } from 'react';

/**
 * The Chirp bird on its own, copied from chirp-frontend's `ChirpAltIcon`.
 *
 * Used in two places, at two sizes, exactly as chirp-frontend uses it: 20×20 as
 * the collapsed sidebar logo, and 56×56 as the empty-state icon. Size comes from
 * the caller rather than being baked in, so one asset serves both — a second
 * copy at a second size is a second thing to update at the next rebrand.
 */
export const ChirpMark = (props: SVGProps<SVGSVGElement>) => (
  <svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
    <path
      d='m24.4 12.5c-0.409-4.21-3.81-7.49-7.95-7.49-2.2 0-4.08 0.813-5.64 2.43-1.56 1.62-5.35 5.91-6.77 20.1l17.4 0.0095c0.313-3.12 0.845-5.83 1.48-8.15l8.09-2.04-6.65-4.82zm-7.54 3.9c-1.6 0-2.9-1.36-2.9-3.03 0-1.67 1.3-3.03 2.9-3.03 1.6 0 2.9 1.36 2.9 3.03-0.0023 1.67-1.3 3.03-2.9 3.03z'
      fill='currentColor'
    />
  </svg>
);
