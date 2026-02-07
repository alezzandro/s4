import i18n from 'i18next';
import HttpApi from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

export const supportedLngs = {
  en: 'English',
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

// Get the URL prefix from the data attribute (same approach as App component)
const nbPrefix = document.documentElement.dataset.nbPrefix || '';

i18n
  .use(HttpApi)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: Object.keys(supportedLngs),
    ns: namespaces,
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: `${nbPrefix}/locales/{{lng}}/{{ns}}.json`,
    },
  });

export default i18n;
