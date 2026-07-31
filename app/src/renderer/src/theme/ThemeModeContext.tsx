import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { buildTheme, readStoredMode, storeMode, type ThemeMode } from './index';

/**
 * Owns the light/dark choice and provides the built MUI theme.
 *
 * The ui-kit ships no ThemeProvider of its own and does not persist the mode —
 * `getTheme({ mode, variant })` is a pure function and persistence is the
 * consumer's job. chirp-frontend persists via `document.cookie`; that is exactly
 * what must NOT be copied here, since there is no domain under file://.
 */

interface ThemeModeContextValue {
    mode: ThemeMode;
    toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
    const [mode, setMode] = useState<ThemeMode>(readStoredMode);

    const toggle = useCallback(() => {
        setMode((current) => {
            const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
            storeMode(next);
            return next;
        });
    }, []);

    const theme = useMemo(() => buildTheme(mode), [mode]);
    const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

    return (
        <ThemeModeContext.Provider value={value}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
};

export const useThemeMode = (): ThemeModeContextValue => {
    const context = useContext(ThemeModeContext);
    if (!context) {
        throw new Error('useThemeMode must be used inside ThemeModeProvider');
    }
    return context;
};
