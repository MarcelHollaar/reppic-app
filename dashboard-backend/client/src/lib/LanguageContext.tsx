import { createContext, useContext, useState, ReactNode } from "react";
import type { Language } from "@/components/LanguageSelector";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): Language {
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  const validLanguages: Language[] = ['nl', 'en', 'de', 'fr', 'es', 'it'];
  
  if (langParam && validLanguages.includes(langParam as Language)) {
    return langParam as Language;
  }
  
  return "nl";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
