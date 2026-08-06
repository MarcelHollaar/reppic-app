import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { prisma } from "@/app/api/utils/prisma";
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";

export const dynamic = "force-dynamic";

/**
 * Meertalige, schakelbare disclaimer voor de agenda-koppeling (pilot/validatie).
 *
 * De TEKST staat als ingebouwde standaard in de code (hieronder), zodat de
 * banner in ELKE omgeving vanzelf werkt — ook in productie, zónder seeden.
 *
 * De platform-instelling `calendar_pilot_notice` is puur een OVERRIDE, aan te
 * passen ZONDER nieuwe deploy:
 *   - rij afwezig            ⇒ ingebouwde standaard (banner toont)
 *   - rij met JSON/tekst     ⇒ die tekst (aangepaste wording per taal)
 *   - rij leeg ("" of "{}")  ⇒ niets (dit is "weghalen zonder deploy")
 *
 * De client stuurt de actieve taal mee als ?lang=xx. Terugval: gevraagde taal →
 * en → nl → eerste niet-lege → "".
 */
const DEFAULT_NOTICE: Record<string, string> = {
  nl: 'Binnenkort beschikbaar: de agenda-koppeling is nog in een pilot- en validatiefase (Google en Microsoft). Je kunt al koppelen; tijdens het koppelen kan een "app niet geverifieerd"-melding verschijnen — dat is verwacht en veilig.',
  en: 'Coming soon: the calendar connection is still in a pilot and validation phase (Google and Microsoft). You can already connect; during connection you may see an "app not verified" message — that is expected and safe.',
  de: "Demnächst verfügbar: Die Kalender-Verbindung befindet sich noch in einer Pilot- und Validierungsphase (Google und Microsoft). Du kannst bereits verbinden; beim Verbinden kann eine Meldung „App nicht verifiziert“ erscheinen — das ist erwartet und sicher.",
  fr: "Bientôt disponible : la connexion à l'agenda est encore en phase pilote et de validation (Google et Microsoft). Vous pouvez déjà connecter ; lors de la connexion, un message « application non vérifiée » peut apparaître — c'est attendu et sans danger.",
  es: 'Próximamente: la conexión del calendario aún está en fase piloto y de validación (Google y Microsoft). Ya puedes conectar; durante la conexión puede aparecer un mensaje de "aplicación no verificada" — es esperado y seguro.',
  it: 'Presto disponibile: la connessione del calendario è ancora in fase pilota e di validazione (Google e Microsoft). Puoi già collegarti; durante il collegamento può comparire un messaggio "app non verificata" — è previsto e sicuro.',
};

function pickFromMap(byLang: Record<string, string>, lang: string): string {
  const norm = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  for (const key of [lang, "en", "nl"]) {
    if (key && norm(byLang[key])) return norm(byLang[key]);
  }
  return Object.values(byLang).map(norm).find(Boolean) ?? "";
}

function pickNotice(rawValue: string, lang: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return pickFromMap(parsed as Record<string, string>, lang);
    }
  } catch {
    // Geen JSON: platte string = tekst voor elke taal (eenvoud/legacy).
    return trimmed;
  }
  return "";
}

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const lang = (req.nextUrl.searchParams.get("lang") || "")
    .toLowerCase()
    .slice(0, 2);

  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: PLATFORM_SETTING_KEYS.CALENDAR_PILOT_NOTICE },
    });
    // Rij aanwezig ⇒ override (kan leeg zijn = verborgen). Rij afwezig ⇒ default.
    const notice = setting
      ? pickNotice(setting.value, lang)
      : pickFromMap(DEFAULT_NOTICE, lang);
    return NextResponse.json({ notice });
  } catch (error) {
    console.error("[Calendar] Notice lookup failed:", error);
    // Niet-kritiek: liever de ingebouwde standaard dan een gebroken pagina.
    return NextResponse.json({ notice: pickFromMap(DEFAULT_NOTICE, lang) });
  }
}
