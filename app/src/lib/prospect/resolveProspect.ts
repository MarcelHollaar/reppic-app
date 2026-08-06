// Pure matching-logica voor het herleiden van de eindklant (prospect) uit
// de deelnemers van een agenda-afspraak. Geen I/O — unit-testbaar.
//
// Sleutelregel (zie bouwplan A6):
// - extern zakelijk domein  -> prospect-sleutel = het domein
// - extern freemail-adres   -> prospect-sleutel = het volledige e-mailadres
//   (prospect-per-persoon; een domein als gmail.com identificeert niemand)

const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.nl",
  "hotmail.be",
  "live.com",
  "live.nl",
  "live.be",
  "msn.com",
  "yahoo.com",
  "yahoo.nl",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "mail.com",
  // Nederlandse providers
  "ziggo.nl",
  "kpnmail.nl",
  "kpnplanet.nl",
  "planet.nl",
  "home.nl",
  "hetnet.nl",
  "casema.nl",
  "chello.nl",
  "upcmail.nl",
  "quicknet.nl",
  "zeelandnet.nl",
  "solcon.nl",
  "telfort.nl",
  "online.nl",
  "xs4all.nl",
]);

export interface ProspectKey {
  // De waarde voor ProspectAccount.domain: zakelijk domein óf volledig
  // freemail-adres.
  domain: string;
  // True wanneer de sleutel een individueel adres is (freemail).
  isPersonal: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 1 || at === normalized.length - 1) return null;
  const domain = normalized.slice(at + 1);
  // Minimale sanity-check: een domein heeft minstens één punt.
  if (!domain.includes(".")) return null;
  return domain;
}

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.toLowerCase());
}

// Systeem-/bot-adressen die nooit een eindklant zijn: de Reppic-notetaker die
// als gast in de afspraak wordt uitgenodigd. Dit filtert ALLEEN wie als
// prospect telt bij het opstellen van de prep — de notetaker-bot zelf blijft
// volledig ongemoeid (wordt gewoon uitgenodigd en neemt op).
const REPPIC_BOT_ADDRESSES = new Set(["notetaker@reppic.ai"]);

// De externe deelnemers (eindklant-kant): alle deelnemers behalve de verkoper
// zelf, diens collega's op hetzelfde zakelijke domein, en systeem-/bot-adressen.
//
// `internalEmail` is het ANKER van de verkoperskant — voor de prep is dat de
// Reppic-gebruiker (agenda-eigenaar), niet per se de organisator: als de klant
// de afspraak organiseert en de verkoper uitnodigt, is de organisator juist de
// prospect. Zit de verkoper op freemail, dan kan niet op domein worden
// uitgesloten en filteren we alleen het exacte adres.
//
// `extraExcludeEmails` laat de caller extra interne/bot-adressen meegeven
// (bijv. een afwijkend notetaker-adres uit de omgeving).
export function extractExternalAttendees(
  attendeeEmails: Array<string | null | undefined>,
  internalEmail: string,
  extraExcludeEmails: Array<string | null | undefined> = []
): string[] {
  const internal = normalizeEmail(internalEmail);
  const internalDomain = emailDomain(internal);
  const excludeByDomain =
    internalDomain !== null && !isFreemailDomain(internalDomain);

  const excludeExact = new Set<string>([internal, ...REPPIC_BOT_ADDRESSES]);
  for (const extra of extraExcludeEmails) {
    if (extra) excludeExact.add(normalizeEmail(extra));
  }

  const seen = new Set<string>();
  const external: string[] = [];
  for (const raw of attendeeEmails) {
    if (!raw) continue;
    const email = normalizeEmail(raw);
    const domain = emailDomain(email);
    if (!domain) continue;
    if (excludeExact.has(email)) continue;
    if (excludeByDomain && domain === internalDomain) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    external.push(email);
  }
  return external;
}

export function deriveProspectKey(email: string): ProspectKey | null {
  const normalized = normalizeEmail(email);
  const domain = emailDomain(normalized);
  if (!domain) return null;
  if (isFreemailDomain(domain)) {
    return { domain: normalized, isPersonal: true };
  }
  return { domain, isPersonal: false };
}

// Leesbare naam voor een nieuwe ProspectAccount zolang er geen CRM-naam
// bekend is: "acme.com" -> "Acme", persoonlijk adres -> local part.
export function deriveProspectDisplayName(key: ProspectKey): string {
  if (key.isPersonal) {
    const local = key.domain.slice(0, key.domain.lastIndexOf("@"));
    return local || key.domain;
  }
  const base = key.domain.split(".")[0] || key.domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
