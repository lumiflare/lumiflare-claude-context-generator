import ja from './ja.js';
import en from './en.js';

const locales = { ja, en };

export const SUPPORTED_LANGS = Object.keys(locales);

export function getLocale(lang) {
  if (!locales[lang]) {
    throw new Error(`Unsupported language: "${lang}". Supported: ${SUPPORTED_LANGS.join(', ')}`);
  }
  return locales[lang];
}
