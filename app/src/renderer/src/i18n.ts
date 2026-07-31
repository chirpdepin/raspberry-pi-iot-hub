import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources, uiKitResourcesByLanguage, SUPPORTED_LANGUAGES } from './locales/resources';

/**
 * i18next, owned by this app.
 *
 * The ui-kit ships its own i18n module with cookie-based language detection, but
 * it is not exported from any subpath — which is fortunate, because cookies do
 * not work under file://. We own the instance and merge only the kit's `uiKit`
 * namespace, the same way chirp-frontend does.
 */

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
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'uiKit'],
  // React already escapes output; double-escaping mangles apostrophes.
  interpolation: { escapeValue: false },
  resources: withUiKit(),
});

export { i18n };
