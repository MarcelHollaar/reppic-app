import type { SupportedLang } from "@/lib/salescoach/prompts";

/** URL / session phase keys (excluding objections — use buildObjectionsWelcomeBase). */
export type StandardWelcomePhaseKey =
  | "opening"
  | "needs_analysis"
  | "offer"
  | "agreement";

const AVATAR_GREETING: Record<
  SupportedLang,
  { prefix: string; suffix: string }
> = {
  en: {
    prefix: "Hey, great that you're here! You want to practice",
    suffix: "Go ahead and start!",
  },
  nl: {
    prefix: "Hé, leuk dat je er bent! Je wilt",
    suffix: "oefenen. Begin maar met de fase!",
  },
  de: {
    prefix: "Hey, toll dass du da bist! Du möchtest",
    suffix: "üben. Fang mit der Phase an!",
  },
  fr: {
    prefix: "Hé, super que tu sois là ! Tu veux pratiquer",
    suffix: "Commence avec la phase !",
  },
  it: {
    prefix: "Ehi, bello che tu sia qui! Vuoi praticare",
    suffix: "Inizia con la fase!",
  },
  es: {
    prefix: "¡Hola, qué bueno que estés aquí! Quieres practicar",
    suffix: "¡Comienza con la fase!",
  },
};

/** Replit `translations[lang].salesPhases` display values per app phase key. */
const PHASE_DISPLAY_NAME: Record<
  SupportedLang,
  Record<StandardWelcomePhaseKey, string>
> = {
  en: {
    opening: "Opening",
    needs_analysis: "Needs Analysis",
    offer: "Offer",
    agreement: "Agreement",
  },
  nl: {
    opening: "Opening",
    needs_analysis: "Behoefteanalyse",
    offer: "Aanbod",
    agreement: "Overeenstemming",
  },
  de: {
    opening: "Eröffnung",
    needs_analysis: "Bedarfsanalyse",
    offer: "Angebot",
    agreement: "Vereinbarung",
  },
  fr: {
    opening: "Ouverture",
    needs_analysis: "Analyse des Besoins",
    offer: "Offre",
    agreement: "Accord",
  },
  it: {
    opening: "Apertura",
    needs_analysis: "Analisi dei Bisogni",
    offer: "Offerta",
    agreement: "Accordo",
  },
  es: {
    opening: "Apertura",
    needs_analysis: "Análisis de Necesidades",
    offer: "Oferta",
    agreement: "Acuerdo",
  },
};

/** Replit `/api/chat` weerstandenGreetings (base only; random objection appended by caller). */
const OBJECTIONS_WELCOME_BASE: Record<SupportedLang, string> = {
  en: "Hi, you want to practice objections? Here comes the first one.",
  nl: "Hoi, je wil weerstanden oefenen? Hier komt de eerste.",
  de: "Hallo, du möchtest Einwände üben? Hier kommt der erste.",
  fr: "Salut, tu veux pratiquer les objections ? Voici la première.",
  it: "Ciao, vuoi esercitarti con le obiezioni? Ecco la prima.",
  es: "Hola, ¿quieres practicar objeciones? Aquí viene la primera.",
};

/**
 * Replit: `${prefix} ${phaseName}. ${suffix}`
 */
export function buildStandardPhaseWelcomeGreeting(
  lang: SupportedLang,
  phaseKey: string
): string {
  const g = AVATAR_GREETING[lang] || AVATAR_GREETING.en;
  const normalized = (phaseKey || "opening").toLowerCase() as string;
  const standardKey = (
    ["opening", "needs_analysis", "offer", "agreement"].includes(normalized)
      ? normalized
      : "opening"
  ) as StandardWelcomePhaseKey;
  const phaseName =
    PHASE_DISPLAY_NAME[lang]?.[standardKey] ||
    PHASE_DISPLAY_NAME.en[standardKey];
  return `${g.prefix} ${phaseName}. ${g.suffix}`;
}

export function buildObjectionsWelcomeBase(lang: SupportedLang): string {
  return OBJECTIONS_WELCOME_BASE[lang] || OBJECTIONS_WELCOME_BASE.en;
}
