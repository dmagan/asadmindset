import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import deTranslation from './locales/de.json';
import frTranslation from './locales/fr.json';  
import itTranslation from './locales/it.json'; 
import esTranslation from './locales/es.json'; 
import rmTranslation from './locales/rm.json'; 


i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: enTranslation,
      de: deTranslation,
      fr: frTranslation, 
      it: itTranslation, 
      es: esTranslation, 
  rm: rmTranslation, 
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;