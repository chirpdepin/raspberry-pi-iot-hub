import uiKitResources from '@chirpwireless/ui-kit/locales';

import common from './common.json';

/**
 * Builds i18next resources from the chirp-frontend file format.
 *
 * Files are keyed by language first (`{ en: {...}, de: {...} }`) because that
 * keeps every translation of a string on adjacent lines, so a missing language
 * is visible when reading the file. i18next wants the inverse
 * (`{ en: { namespace: {...} } }`), so this transposes it once at startup.
 *
 * Key = English text, matching chirp-frontend. That means a missing translation
 * degrades to readable English rather than to a dotted identifier leaking into
 * the UI.
 */

export const SUPPORTED_LANGUAGES = ['en', 'de', 'es', 'fr', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type TranslationFile = Record<string, Record<string, string>>;
type UiKitResources = Record<string, { uiKit?: Record<string, unknown> }>;

/** namespace -> file. Add a namespace per module as screens are built. */
const FILES: Record<string, TranslationFile> = {
  common: common as TranslationFile,
};

const kit = uiKitResources as unknown as UiKitResources;

const buildResources = () => {
  const resources: Record<string, Record<string, Record<string, string>>> = {};

  for (const language of SUPPORTED_LANGUAGES) {
    resources[language] = {};

    for (const [namespace, file] of Object.entries(FILES)) {
      resources[language][namespace] = file[language] ?? {};
    }
  }

  return resources;
};

export const resources = buildResources();

export const uiKitResourcesByLanguage = kit;
