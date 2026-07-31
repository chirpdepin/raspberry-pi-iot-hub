import { getTheme } from '@chirpwireless/ui-kit/theme';
import type { Palette, Theme } from '@mui/material';

import './fonts.css';

/**
 * The single source of truth for every visual token in the app (Contract 4).
 *
 * Nothing outside this directory may contain a colour literal, and the boundary
 * checker enforces that. Components read `theme.palette.*` and `theme.spacing()`,
 * so a Chirp rebrand is a ui-kit version bump rather than a hunt through JSX for
 * hex codes that will not match whatever the new colour is.
 */

export type ThemeMode = 'light' | 'dark';

/** Persisted here rather than in a cookie: there is no domain under file://. */
const STORAGE_KEY = 'chirp-hub.theme-mode';

export const DEFAULT_MODE: ThemeMode = 'dark';

export function readStoredMode(): ThemeMode {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : DEFAULT_MODE;
    } catch {
        // Storage can be unavailable in a sandboxed or first-run renderer.
        // A missing preference is not an error — fall back to the default.
        return DEFAULT_MODE;
    }
}

export function storeMode(mode: ThemeMode): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // Losing the preference is acceptable; failing to render is not.
    }
}

/**
 * `variant: 'chirp'` selects Chirp's brand palette rather than the Kilo default.
 * This is the one place that choice is made.
 */
export const buildTheme = (mode: ThemeMode): Theme => getTheme({ mode, variant: 'chirp' });

/**
 * The ui-kit extends MUI's Palette with `neutral`, `borders`, `alerts`,
 * `primaryColors`, `framing`, `additionalColors`, `widgets` and `shadow`, but it
 * does **not** export the `chirpPalette` helper that reads them — there is no
 * `./theme/palette` subpath in its exports map, so a deep import is blocked.
 *
 * Re-declared here so components have a typed way to reach brand tokens.
 * If the kit ever exports it, delete this and import theirs.
 */
export interface ChirpPaletteExtras {
    neutral: Record<string, string>;
    borders: Record<string, string>;
    alerts: Record<string, string>;
    primaryColors: Record<string, string>;
    shadow: string;
}

export const chirpPalette = (theme: Theme): Palette & ChirpPaletteExtras =>
    theme.palette as unknown as Palette & ChirpPaletteExtras;
