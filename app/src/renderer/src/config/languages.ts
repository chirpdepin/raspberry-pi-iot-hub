/**
 * The languages this app offers — Contract 4's single source of truth.
 *
 * Labels are each language's own name, matching
 * `chirp-frontend/src/locales/i18n/languages.ts` exactly, so the two products
 * offer the same list spelled the same way. A language is written in its own
 * language on purpose: someone who has landed in the wrong one cannot read
 * "German", but can read "Deutsch".
 *
 * Contract 1 (O): a sixth language is a row here plus its translations in
 * `locales/resources/common.json`. No component is edited, and the boundary
 * checker's `i18n-complete` rule fails the build if the translations are
 * missing.
 */
export const LANGUAGES = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export const isLanguageCode = (value: string): value is LanguageCode => value in LANGUAGES;

/** The default, and the fallback whenever a stored value is unusable. */
export const DEFAULT_LANGUAGE: LanguageCode = 'en';
