/**
 * The Chirp wordmark, copied verbatim from
 * `chirp-frontend/src/assets/chirp/Logo.tsx`.
 *
 * Inline SVG rather than a file, for two reasons: a strict offline app should
 * not depend on an asset URL resolving under `file://`, and every path uses
 * `currentColor`, so the mark takes its colour from whatever the sidebar sets —
 * which is how chirp-frontend tints it `palette.primary.light` without a second
 * copy of the artwork per theme (Contract 4).
 */
export const ChirpLogo = () => (
  <svg width='107' height='40' viewBox='0 0 107 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <g clipPath='url(#chirp-hub-logo-clip)'>
      <path
        d='M9.69276 13C8.33271 13 7.15684 13.4754 6.19347 14.4261C5.23011 15.3768 2.87836 17.8934 2 26.1843H12.8095C13.0079 24.3528 13.3337 22.7729 13.7304 21.4027L18.7456 20.2003L14.6229 17.3901C14.3679 14.9294 12.257 13 9.69276 13ZM9.94777 19.683C8.95607 19.683 8.14854 18.8861 8.14854 17.9074C8.14854 16.9287 8.95607 16.1318 9.94777 16.1318C10.9395 16.1318 11.747 16.9147 11.747 17.9074C11.747 18.8861 10.9395 19.683 9.94777 19.683Z'
        fill='currentColor'
      />
      <path
        d='M32.0195 20.007C32.0195 22.8716 34.37 25.1913 37.2727 25.1913H47.2553V20.9991H37.2727C36.7205 20.9991 36.2674 20.552 36.2674 20.007C36.2674 19.462 36.7205 19.0148 37.2727 19.0148H47.2553V14.8227H37.2727C34.3842 14.8227 32.0195 17.1424 32.0195 20.007Z'
        fill='currentColor'
      />
      <path
        d='M101.981 14.8227H89.875V28H94.1229V25.1913H101.981C104.884 25.1913 107.235 22.8716 107.235 20.007C107.235 17.1424 104.884 14.8227 101.981 14.8227ZM101.981 20.9991H94.1229V19.0148H101.981C102.534 19.0148 102.987 19.462 102.987 20.007C102.987 20.552 102.534 20.9991 101.981 20.9991Z'
        fill='currentColor'
      />
      <path
        d='M61.3863 14.8227H54.4481V12H50.2002V25.1913H54.4481V19.0148H61.3863C62.0801 19.0148 62.6323 19.5598 62.6323 20.2445V25.1913H66.8802V20.2445C66.8802 17.2541 64.4164 14.8227 61.3863 14.8227Z'
        fill='currentColor'
      />
      <path d='M74.0867 14.8227H69.8389V25.1913H74.0867V14.8227Z' fill='currentColor' />
      <path
        d='M81.4364 14.8227H77.1885V25.1913H81.4364V20.51L87.6241 19.0148V14.8227L81.4364 16.3179V14.8227Z'
        fill='currentColor'
      />
    </g>
    <defs>
      <clipPath id='chirp-hub-logo-clip'>
        <rect width='107' height='40' fill='currentColor' />
      </clipPath>
    </defs>
  </svg>
);
