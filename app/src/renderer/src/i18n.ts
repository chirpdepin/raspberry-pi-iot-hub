import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources, uiKitResourcesByLanguage, SUPPORTED_LANGUAGES } from './locales/resources';
import { DEFAULT_LANGUAGE, isLanguageCode, LANGUAGE_CODES, type LanguageCode } from './config/languages';

/**
 * i18next, owned by this app.
 *
 * The ui-kit ships its own i18n module with cookie-based language detection, but
 * it is not exported from any subpath — which is fortunate, because cookies do
 * not work under file://. We own the instance and merge only the kit's `uiKit`
 * namespace, the same way chirp-frontend does.
 *
 * The chosen language is persisted in localStorage, reusing exactly the
 * mechanism `theme/index.ts` already uses for light/dark. Without it the app
 * would reset to English on every launch — the selector would appear to work
 * and then quietly forget, which is worse than having no selector.
 */

/** Same storage convention as the theme mode, so both survive a restart. */
const STORAGE_KEY = 'chirp-hub.language';

export const readStoredLanguage = (): LanguageCode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // Storage can be unavailable in a sandboxed or first-run renderer. A
    // missing preference is not an error.
    return DEFAULT_LANGUAGE;
  }
};

const storeLanguage = (language: LanguageCode): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Losing the preference is acceptable; failing to render is not.
  }
};

/** Switches language and remembers it. The only way the app should change language. */
export const changeLanguage = async (language: LanguageCode): Promise<void> => {
  storeLanguage(language);
  await i18n.changeLanguage(language);
};

const withUiKit = () => {
  const merged: Resource = {};

  for (const language of SUPPORTED_LANGUAGES) {
    merged[language] = {
      ...resources[language],
      uiKit: uiKitResourcesByLanguage[language]?.uiKit ?? {},
    };
  }

  return merged;
};

void i18n.use(initReactI18next).init({
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  // Without this i18next accepts any string, so a stale or hand-edited stored
  // value would leave the UI on a language with no resources at all.
  supportedLngs: LANGUAGE_CODES,
  defaultNS: 'common',
  ns: ['common', 'uiKit'],
  // React already escapes output; double-escaping mangles apostrophes.
  interpolation: { escapeValue: false },
  resources: withUiKit(),
});

export { i18n };
