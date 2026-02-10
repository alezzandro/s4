import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Bundled translations – imported statically so changeLanguage() is synchronous
import enTranslation from './locales/en/translation.json';
import enStorageBrowser from './locales/en/storage-browser.json';
import enBuckets from './locales/en/buckets.json';
import enSettings from './locales/en/settings.json';
import enTransfer from './locales/en/transfer.json';
import enLogin from './locales/en/login.json';
import enErrors from './locales/en/errors.json';

import frTranslation from './locales/fr/translation.json';
import frStorageBrowser from './locales/fr/storage-browser.json';
import frBuckets from './locales/fr/buckets.json';
import frSettings from './locales/fr/settings.json';
import frTransfer from './locales/fr/transfer.json';
import frLogin from './locales/fr/login.json';
import frErrors from './locales/fr/errors.json';

import esTranslation from './locales/es/translation.json';
import esStorageBrowser from './locales/es/storage-browser.json';
import esBuckets from './locales/es/buckets.json';
import esSettings from './locales/es/settings.json';
import esTransfer from './locales/es/transfer.json';
import esLogin from './locales/es/login.json';
import esErrors from './locales/es/errors.json';

import itTranslation from './locales/it/translation.json';
import itStorageBrowser from './locales/it/storage-browser.json';
import itBuckets from './locales/it/buckets.json';
import itSettings from './locales/it/settings.json';
import itTransfer from './locales/it/transfer.json';
import itLogin from './locales/it/login.json';
import itErrors from './locales/it/errors.json';

import zhTranslation from './locales/zh/translation.json';
import zhStorageBrowser from './locales/zh/storage-browser.json';
import zhBuckets from './locales/zh/buckets.json';
import zhSettings from './locales/zh/settings.json';
import zhTransfer from './locales/zh/transfer.json';
import zhLogin from './locales/zh/login.json';
import zhErrors from './locales/zh/errors.json';

import jaTranslation from './locales/ja/translation.json';
import jaStorageBrowser from './locales/ja/storage-browser.json';
import jaBuckets from './locales/ja/buckets.json';
import jaSettings from './locales/ja/settings.json';
import jaTransfer from './locales/ja/transfer.json';
import jaLogin from './locales/ja/login.json';
import jaErrors from './locales/ja/errors.json';

import koTranslation from './locales/ko/translation.json';
import koStorageBrowser from './locales/ko/storage-browser.json';
import koBuckets from './locales/ko/buckets.json';
import koSettings from './locales/ko/settings.json';
import koTransfer from './locales/ko/transfer.json';
import koLogin from './locales/ko/login.json';
import koErrors from './locales/ko/errors.json';

import deTranslation from './locales/de/translation.json';
import deStorageBrowser from './locales/de/storage-browser.json';
import deBuckets from './locales/de/buckets.json';
import deSettings from './locales/de/settings.json';
import deTransfer from './locales/de/transfer.json';
import deLogin from './locales/de/login.json';
import deErrors from './locales/de/errors.json';

export const supportedLngs: Record<string, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  fr: { name: 'Français', flag: '🇫🇷' },
  es: { name: 'Español', flag: '🇪🇸' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  zh: { name: '中文', flag: '🇨🇳' },
  ja: { name: '日本語', flag: '🇯🇵' },
  ko: { name: '한국어', flag: '🇰🇷' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
};

// Define all translation namespaces
export const namespaces = [
  'translation', // Common/global translations
  'storage-browser', // StorageBrowser component
  'buckets', // Buckets component
  'settings', // Settings component
  'transfer', // Transfer components
  'login', // Login component
  'errors', // Common error messages
] as const;

export type Namespace = (typeof namespaces)[number];

const resources = {
  en: {
    translation: enTranslation,
    'storage-browser': enStorageBrowser,
    buckets: enBuckets,
    settings: enSettings,
    transfer: enTransfer,
    login: enLogin,
    errors: enErrors,
  },
  fr: {
    translation: frTranslation,
    'storage-browser': frStorageBrowser,
    buckets: frBuckets,
    settings: frSettings,
    transfer: frTransfer,
    login: frLogin,
    errors: frErrors,
  },
  es: {
    translation: esTranslation,
    'storage-browser': esStorageBrowser,
    buckets: esBuckets,
    settings: esSettings,
    transfer: esTransfer,
    login: esLogin,
    errors: esErrors,
  },
  it: {
    translation: itTranslation,
    'storage-browser': itStorageBrowser,
    buckets: itBuckets,
    settings: itSettings,
    transfer: itTransfer,
    login: itLogin,
    errors: itErrors,
  },
  zh: {
    translation: zhTranslation,
    'storage-browser': zhStorageBrowser,
    buckets: zhBuckets,
    settings: zhSettings,
    transfer: zhTransfer,
    login: zhLogin,
    errors: zhErrors,
  },
  ja: {
    translation: jaTranslation,
    'storage-browser': jaStorageBrowser,
    buckets: jaBuckets,
    settings: jaSettings,
    transfer: jaTransfer,
    login: jaLogin,
    errors: jaErrors,
  },
  ko: {
    translation: koTranslation,
    'storage-browser': koStorageBrowser,
    buckets: koBuckets,
    settings: koSettings,
    transfer: koTransfer,
    login: koLogin,
    errors: koErrors,
  },
  de: {
    translation: deTranslation,
    'storage-browser': deStorageBrowser,
    buckets: deBuckets,
    settings: deSettings,
    transfer: deTransfer,
    login: deLogin,
    errors: deErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    ns: namespaces,
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    resources,
    react: {
      useSuspense: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
