import type { SupportedLang } from "@/lib/salescoach/prompts";

/**
 * Canonical assistant lines that ask whether to practice again (Replit `/api/chat` parity).
 * `isPracticeAgainQuestion` matches when the last assistant message *contains* one of these
 * strings (case-insensitive), so it still works when the line is appended after feedback.
 *
 * Intentional: we only match these templates + clarification copies of the same ask — not
 * free-form regex on user text — to avoid false positives on objection scripts.
 */
export const OBJECTION_CLOSURE_QUESTIONS: Record<SupportedLang, string> = {
  nl: "Wil je nog een weerstand oefenen?",
  en: "Do you want to practice another objection?",
  de: "Möchtest du einen weiteren Einwand üben?",
  fr: "Veux-tu pratiquer une autre objection?",
  it: "Vuoi praticare un'altra obiezione?",
  es: "¿Quieres practicar otra objeción?",
};

/** Appended after approval-style lines in the offer phase (leading space in EN is historical). */
export const PRACTICE_AGAIN_QUESTIONS: Record<SupportedLang, string> = {
  nl: " Wil je opnieuw oefenen?",
  en: " Would you like to practice again?",
  de: " Möchtest du erneut üben?",
  fr: " Veux-tu pratiquer à nouveau?",
  it: " Vuoi esercitarti di nuovo?",
  es: " ¿Quieres practicar de nuevo?",
};

export const CLARIFICATION_MESSAGES: Record<SupportedLang, string> = {
  nl: "Sorry, ik begreep het niet helemaal. Wil je opnieuw oefenen? Zeg 'ja' of 'nee'.",
  en: "Sorry, I didn't quite understand. Do you want to practice again? Say 'yes' or 'no'.",
  de: "Entschuldigung, ich habe das nicht ganz verstanden. Möchtest du erneut üben? Sag 'ja' oder 'nein'.",
  fr: "Désolé, je n'ai pas bien compris. Veux-tu pratiquer à nouveau? Dis 'oui' ou 'non'.",
  it: "Scusa, non ho capito bene. Vuoi esercitarti di nuovo? Dì 'sì' o 'no'.",
  es: "Lo siento, no entendí bien. ¿Quieres practicar de nuevo? Di 'sí' o 'no'.",
};

const EXTRA_PRACTICE_AGAIN_SUBSTRINGS: string[] = [
  // Replit / spoken variants not always identical to templates above
  "wil je nog een keer oefenen",
  "would you like to practice another",
  "möchtest du nochmal üben",
  "veux-tu réessayer",
  "vuoi riprovare",
  "quieres intentarlo otra vez",
];

/**
 * True when the assistant's last message is (or ends with) a practice-again prompt.
 */
export function isPracticeAgainQuestion(lastAvatarMessage: string): boolean {
  const t = lastAvatarMessage.replace(/\s+/g, " ").trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  const needles: string[] = [
    ...Object.values(OBJECTION_CLOSURE_QUESTIONS),
    ...Object.values(PRACTICE_AGAIN_QUESTIONS).map((s) => s.trim()),
    ...Object.values(CLARIFICATION_MESSAGES),
    ...EXTRA_PRACTICE_AGAIN_SUBSTRINGS,
  ];

  const seen = new Set<string>();
  for (const raw of needles) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (lower.includes(key)) return true;
  }
  return false;
}
