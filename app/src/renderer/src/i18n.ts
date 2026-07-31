import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uiKitResources from '@chirpwireless/ui-kit/locales';

import en from './locales/en/translation.json';

/**
 * i18next, owned by this app.
 *
 * The ui-kit ships its own i18n module with cookie-based language detection, but
 * it is not exported from any subpath — which is fortunate, because cookies do
 * not work under file://. We own the instance and merge only the kit's `uiKit`
 * namespace, the same way chirp-frontend does.
 *
 * Contract 4: every user-facing string is a key. Adding a language is a new JSON
 * file plus a row here — no code changes.
 */

type UiKitResources = Record<string, { uiKit: Record<string, unknown> }>;
const kit = uiKitResources as unknown as UiKitResources;

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'translation',
    ns: ['translation', 'uiKit'],
    interpolation: {
        // React already escapes; double-escaping mangles apostrophes.
        escapeValue: false,
    },
    resources: {
        en: {
            translation: en,
            uiKit: kit['en']?.uiKit ?? {},
        },
    },
});

export default i18n;
