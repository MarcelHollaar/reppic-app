// lib/i18n.js
'use client';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
const supportedLocales = require('../../supported-locales.json');

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend((language, namespace) =>
      import(`../../public/locales/${language}/${namespace}.json`)
    )
  )
  .init({
  fallbackLng: 'en',
  supportedLngs: supportedLocales,
  ns: ['common'],
  defaultNS: 'common',
  detection: {
    order: ['cookie', 'navigator'], // Remove 'path'
    lookupCookie: 'NEXT_LOCALE',
    caches: ['cookie'],
  },
});

export default i18next;