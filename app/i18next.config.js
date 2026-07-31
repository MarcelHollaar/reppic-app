// i18next.config.js
const path = require('path');
const supportedLocales = require('./supported-locales.json');

module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: supportedLocales,
  },
  localePath: path.resolve('./public/locales'), // Store translations in public/locales
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};