import { EXPECTED_FASES } from "./promptSchema";
import { transcriptAnalysisPromptService } from "@/app/api/services/transcriptAnalysisPromptService";

export type LlmFn = (prompt: string) => Promise<string>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_SFEER = ["Positief", "Neutraal", "Negatief"];
const VALID_KLANTTYPE = ["Rood", "Groen", "Blauw", "Geel"];
const VALID_CONCLUSIE = ["Goed", "Fout"];

// The 15 fixed phases (Fase + Titel composite key) live in promptSchema.ts so
// the admin prompt-editor and this analyzer share one source of truth.
const FASE_COUNT = EXPECTED_FASES.length; // 15
const MAX_FASE_SCORE = 3;

// NL reference data for fase enrichment. For other languages, load the
// appropriate translation and pass as `referenceData` to analyze().
const NL_FASE_REFERENCE = [
  {
    Fase: 1,
    Titel: "Break the ice",
    Doel: "Het doel is om een positieve start van het gesprek te creëren en een ontspannen sfeer te bevorderen. Dit zorgt voor een goede basis voor verdere communicatie.",
    AnalysePunten:
      "1. Begroet de verkoper de klant vriendelijk  en met een positieve toon?\n2. Gebruikt de verkoper een persoonlijke noot, bijvoorbeeld een referentie naar een eerdere interactie of een gemeenschappelijke interesse?\n3. Reageert de klant positief met een vriendelijke ontspannen opmerking?",
    GoedVoorbeeld:
      'Start: De verkoper begroet de klant vriendelijk: "Goedemiddag, fijn dat u tijd heeft vrijgemaakt. Hoe gaat het vandaag?"\nEffect: De klant reageert vriendelijk en positief terug en zegt: "Prima, dank u. En met u?" Dit creëert een ontspannen en positieve sfeer.',
    DeelsGoedVoorbeeld:
      'Start: De verkoper opent neutraal en zegt: "Goedemiddag, laten we beginnen."\nEffect: De klant antwoord kort en zakelijk, maar toont geen duidelijke positieve emotie. De toon is professioneel, maar mist warmte.',
    FoutVoorbeeld:
      'Start: De verkoper zegt gehaast: "Laten we meteen aan de slag gaan. Uw tijd is kostbaar."\nEffect: De klant kijkt enigszins verbaasd en reageert kortaf: "Oké." Dit kan een negatieve invloed hebben op de sfeer.',
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper begroet de klant vriendelijk, met een glimlach en een persoonlijke noot. De klant reageert positief.",
    ToekenningPuntenDeelsGoed:
      "De verkoper begroet de klant op een neutrale manier, zonder een persoonlijke noot. De klant reageert niet negatief, maar ook niet enthousiast.",
    ToekenningPuntenFout:
      "De verkoper begroet de klant op een onpersoonlijke of gehaaste manier. De klant toont ongeduld of negatieve emotie.",
  },
  {
    Fase: 1,
    Titel: "Sales pitch",
    Doel: "Het doel van de sales pitch is om jezelf en je bedrijf sterk te positioneren, waardoor de klant direct vertrouwen krijgt in je expertise en de toegevoegde waarde van je organisatie.",
    AnalysePunten:
      "1. Stelt de verkoper zichzelf en het bedrijf helder en overtuigend voor binnen de eerste 2 minuten?\n2. Wordt er een link gelegd tussen de introductie en de mogelijke behoeften van de klant?\n3. Gebruikt de verkoper concrete voorbeelden of relevante feiten om zijn/haar expertise te onderbouwen?",
    GoedVoorbeeld:
      'Start: De verkoper zegt: "Mijn naam is Jan en ik werk al meer dan 10 jaar in deze industrie. Ons bedrijf is gespecialiseerd in het leveren van oplossingen die bedrijven zoals het uwe helpen efficiënter te werken."\nEffect: De klant toont interesse en vraagt door over de expertise van de verkoper.',
    DeelsGoedVoorbeeld:
      'Start: De verkoper zegt: "Ik ben Jan en ik werk voor [Bedrijfsnaam]. We bieden oplossingen voor bedrijven zoals het uwe."\nEffect: De introductie is kort en feitelijk, maar mist onderscheidend vermogen of concrete voorbeelden.',
    FoutVoorbeeld:
      'Start: De verkoper opent met: "Ik ben Jan en wij zijn een bedrijf dat veel producten levert. Wat wilt u weten?"\nEffect: De klant reageert afwachtend of verward, omdat de verkoper niet duidelijk overkomt.',
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper introduceert zichzelf en het bedrijf overtuigend, koppelt de introductie aan de behoeften van de klant en gebruikt concrete voorbeelden of feiten.",
    ToekenningPuntenDeelsGoed:
      "De verkoper introduceert zichzelf en het bedrijf op een neutrale of algemene manier, zonder concrete voorbeelden of duidelijke koppeling aan klantbehoeften.",
    ToekenningPuntenFout:
      "De verkoper introduceert zichzelf onduidelijk of laat de introductie volledig achterwege, waardoor de klant afwachtend of verward raakt.",
  },
  {
    Fase: 1,
    Titel: "Doel van het gesprek",
    Doel: "Het doel hierbij is om de verwachtingen van de klant te managen door duidelijk het doel van de afspraak te communiceren en te vragen of de klant hiermee instemt of misschien een ander of aanvullend doel heeft",
    AnalysePunten:
      "1, Legt de verkoper het doel van de afspraak duidelijk uit aan de klant?\n2. Wordt er expliciet gevraagd of de klant akkoord gaat met het voorgestelde doel?\n3. Geeft de klant een duidelijke bevestiging of input over de verwachtingen van de afspraak?",
    GoedVoorbeeld:
      'Start: De verkoper zegt: "Mijn doel vandaag is om te bespreken hoe wij uw processen kunnen optimaliseren en samen tot concrete stappen te komen. Klinkt dat goed voor u?"\nEffect: De klant reageert bevestigend.',
    DeelsGoedVoorbeeld:
      'Start: De verkoper zegt: "Vandaag wil ik onze diensten aan u uitleggen."\nEffect: Het doel is gedeeltelijk gecommuniceerd, maar blijft algemeen en er wordt niet expliciet gevraagd naar instemming.',
    FoutVoorbeeld:
      "Start: De verkoper gaat direct over op productinformatie zonder het doel van de afspraak te benoemen.\nEffect: De klant blijft onduidelijk over het waarom van de afspraak.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper legt het doel van de afspraak helder uit, vraagt om instemming en de klant geeft een duidelijke bevestiging of input.",
    ToekenningPuntenDeelsGoed:
      "Het doel van de afspraak wordt genoemd, maar zonder expliciete vraag om instemming of zonder duidelijke reactie van de klant.",
    ToekenningPuntenFout:
      "Het doel van de afspraak wordt niet of onduidelijk gecommuniceerd, waardoor de klant in onzekerheid blijft.",
  },
  {
    Fase: 1,
    Titel: "Verwachting klant managen",
    Doel: "Het doel van dit gedeelte is om de klant mee te nemen in het proces door uit te leggen dat de verkoper gerichte vragen zal stellen. Hiermee creëert de verkoper helderheid en een gestructureerde opbouw van het gesprek.",
    AnalysePunten:
      "1. Legt de verkoper duidelijk uit dat er gerichte vragen gesteld zullen worden om de behoeften van de klant te begrijpen?\n2. Krijgt de klant de kans om akkoord te gaan of vragen te stellen over deze aanpak?\n3. Reageert de klant positief of neutraal op de uitleg van de verkoper?",
    GoedVoorbeeld:
      'Start: De verkoper zegt: "Om ervoor te zorgen dat ik u de beste oplossing kan bieden, zal ik u een aantal vragen stellen over uw huidige situatie. Dat helpt mij om een goed beeld te krijgen. Is dat oké?"\nEffect: De klant reageert positief.',
    DeelsGoedVoorbeeld:
      'Start: De verkoper zegt: "Ik wil u een paar vragen stellen om uw situatie beter te begrijpen."\nEffect: De klant reageert neutraal of met een eenvoudige "Oké", maar er wordt geen actieve betrokkenheid gecreëerd.',
    FoutVoorbeeld:
      'Start: De verkoper begint direct met vragen zonder enige uitleg van het proces.\nEffect: De klant kijkt verward of reageert met: "Waarom vraagt u dit?"',
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper legt helder uit dat er vragen gesteld zullen worden, vraagt expliciet om akkoord en de klant reageert positief.",
    ToekenningPuntenDeelsGoed:
      "De verkoper benoemt dat er vragen zullen komen, maar vraagt niet om akkoord of krijgt geen duidelijke reactie van de klant.",
    ToekenningPuntenFout:
      "De verkoper geeft geen uitleg over het stellen van vragen, waardoor de klant verrast of ongemakkelijk reageert.",
  },
  {
    Fase: 2,
    Titel: "Contact person",
    Doel: 'Het doel van "contact person" is om de rol en invloed van de klant binnen de organisatie te begrijpen. Dit helpt de verkoper om de juiste aanpak en strategie te bepalen tijdens het gesprek.',
    AnalysePunten:
      "1. Vraagt de verkoper naar de rol en verantwoordelijkheden van de contactpersoon (klant) binnen de organisatie?\n2. Worden er gerichte vragen gesteld om te achterhalen welke beslissingsbevoegdheid de klant heeft?\n3. Komt de verkoper erachter wie er nog meer betrokken zijn bij het beslissingsproces?\n4. Wordt er gevraagd naar de persoonlijke doelen van de klant?",
    GoedVoorbeeld:
      'Start: De verkoper vraagt: "Kunt u mij vertellen wat uw rol precies inhoudt en in hoeverre u betrokken bent bij het beslissingsproces?" en vervolgt met: "Zijn er nog andere collega\'s die hierbij betrokken zijn?"',
    DeelsGoedVoorbeeld:
      "De verkoper vraagt naar de rol, maar mist verdieping in beslissingsbevoegdheid of andere betrokkenen.",
    FoutVoorbeeld:
      "De verkoper stelt geen vragen over de rol of verantwoordelijkheden.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt gerichte vragen over de rol, verantwoordelijkheden en beslissingsbevoegdheid van de contactpersoon en verkrijgt een volledig beeld.",
    ToekenningPuntenDeelsGoed:
      "De verkoper vraagt naar de rol, maar mist verdieping in beslissingsbevoegdheid of andere betrokkenen.",
    ToekenningPuntenFout:
      "De verkoper stelt geen vragen over de rol of verantwoordelijkheden, waardoor belangrijke informatie wordt gemist.",
  },
  {
    Fase: 2,
    Titel: "Company",
    Doel: 'Het doel van "company" is om inzicht te krijgen in het bedrijf van de klant.',
    AnalysePunten:
      "1. Vraagt de verkoper naar de grootte, structuur en marktpositie van het bedrijf?\n2. Worden er vragen gesteld over de belangrijkste uitdagingen of doelen van het bedrijf?\n3. Onderzoekt de verkoper de strategie of visie van het bedrijf om de context beter te begrijpen?",
    GoedVoorbeeld:
      "De verkoper vraagt naar omvang, markten, en uitdagingen en krijgt een volledig beeld.",
    DeelsGoedVoorbeeld:
      "De verkoper vraagt naar algemene informatie maar mist verdieping.",
    FoutVoorbeeld: "De verkoper stelt geen vragen over het bedrijf.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt gerichte vragen over de grootte, structuur, uitdagingen en visie van het bedrijf en verkrijgt een volledig beeld.",
    ToekenningPuntenDeelsGoed:
      "De verkoper vraagt naar algemene informatie, zoals de grootte of markt, maar mist verdieping in uitdagingen of strategie.",
    ToekenningPuntenFout:
      "De verkoper stelt geen vragen over het bedrijf, waardoor essentiële informatie ontbreekt.",
  },
  {
    Fase: 2,
    Titel: "Cooperation",
    Doel: 'Het doel van "cooperation" is om te achterhalen hoe de samenwerking eruit zou kunnen zien.',
    AnalysePunten:
      "1. Vraagt de verkoper naar de verwachtingen van de klant over de samenwerking?\n2. Worden er vragen gesteld over eerdere ervaringen met vergelijkbare samenwerkingen?\n3. Onderzoekt de verkoper specifieke voorkeuren of voorwaarden?",
    GoedVoorbeeld:
      "De verkoper vraagt naar verwachtingen, eerdere ervaringen en voorkeuren.",
    DeelsGoedVoorbeeld:
      "De verkoper vraagt naar verwachtingen maar mist verdieping.",
    FoutVoorbeeld: "De verkoper stelt geen vragen over samenwerking.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt gerichte vragen over verwachtingen, eerdere ervaringen en specifieke voorkeuren, en krijgt een volledig beeld van de gewenste samenwerking.",
    ToekenningPuntenDeelsGoed:
      "De verkoper vraagt naar algemene verwachtingen, maar mist verdieping in eerdere ervaringen of specifieke voorkeuren.",
    ToekenningPuntenFout:
      "De verkoper stelt geen vragen over samenwerking of verwachtingen, waardoor essentiële informatie ontbreekt.",
  },
  {
    Fase: 2,
    Titel: "Consequences",
    Doel: 'Het doel van "consequences" is om de gevolgen van de huidige uitdagingen of problemen van de klant te begrijpen.',
    AnalysePunten:
      "1. Vraagt de verkoper naar de impact van de huidige uitdagingen?\n2. Onderzoekt de verkoper of het probleem effect heeft op specifieke teams, processen of bedrijfsresultaten?\n3. Laat de verkoper de klant nadenken over de gevolgen van het niet oplossen van het probleem?\n4. Laat de verkoper de klant ook vertellen wat de gevolgen zijn als de uitdagingen wel worden opgelost?",
    GoedVoorbeeld:
      "De verkoper vraagt naar impact en gevolgen, zowel korte- als langetermijneffecten.",
    DeelsGoedVoorbeeld:
      "De verkoper vraagt naar algemene impact maar mist verdieping.",
    FoutVoorbeeld: "De verkoper stelt geen vragen over de gevolgen.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt gerichte vragen naar de impact en gevolgen van het probleem en verkent zowel korte- als langetermijneffecten.",
    ToekenningPuntenDeelsGoed:
      "De verkoper vraagt naar de algemene impact, maar mist verdieping in specifieke gevolgen of de urgentie.",
    ToekenningPuntenFout:
      "De verkoper stelt geen vragen over de gevolgen, waardoor belangrijke inzichten over de noodzaak van een oplossing ontbreken.",
  },
  {
    Fase: 2,
    Titel: "Cure",
    Doel: 'Het doel van "cure" is om inzicht te krijgen in hoe de klant zelf de ideale oplossing ziet.',
    AnalysePunten:
      "1. Vraagt de verkoper expliciet naar de visie van de klant op een ideale oplossing?\n2. Stelt de verkoper doorvraagvragen om een helder en gedetailleerd beeld te krijgen?\n3. Zorgt de verkoper voor een open gesprek?",
    GoedVoorbeeld:
      "De verkoper vraagt naar de ideale oplossing en volgt op voor gedetailleerde informatie.",
    DeelsGoedVoorbeeld:
      "De verkoper vraagt naar een oplossing maar mist verdieping.",
    FoutVoorbeeld: "De verkoper stelt geen vragen over de ideale oplossing.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt gerichte vragen over de ideale oplossing van de klant en vraagt door om gedetailleerde informatie.",
    ToekenningPuntenDeelsGoed:
      "De verkoper vraagt naar een algemene oplossing, maar mist verdieping en specifieke details.",
    ToekenningPuntenFout:
      "De verkoper stelt geen vragen over de ideale oplossing, waardoor essentiële inzichten over de klantverwachtingen ontbreken.",
  },
  {
    Fase: 2,
    Titel: "Doorvragen",
    Doel: 'Het doel van "doorvragen" is om verdiepende vragen te stellen bij elke van de 5 C\'s.',
    AnalysePunten:
      "1. Heeft de verkoper open en verdiepende vragen gesteld over de besproken C's?\n2. Zijn de antwoorden van de klant verder uitgediept met gerichte doorvraagtechnieken?\n3. Zorgt de verkoper ervoor dat de klant volledig en gedetailleerd antwoord geeft?",
    GoedVoorbeeld:
      "De verkoper stelt open en verdiepende vragen met doorvraagtechnieken.",
    DeelsGoedVoorbeeld:
      "De verkoper stelt algemene vragen zonder verdere verdieping.",
    FoutVoorbeeld: "De verkoper stelt geen verdiepende vragen.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt open en verdiepende vragen en gebruikt doorvraagtechnieken om gedetailleerde informatie te verkrijgen.",
    ToekenningPuntenDeelsGoed:
      "De verkoper stelt algemene vragen zonder verdere verdieping, wat leidt tot oppervlakkige antwoorden.",
    ToekenningPuntenFout:
      "De verkoper stelt geen verdiepende vragen, waardoor essentiële inzichten ontbreken.",
  },
  {
    Fase: 2,
    Titel: "Klanttype bepalen",
    Doel: "Het doel van deze fase is om de behoefte van de klant volledig te achterhalen en het klanttype te bepalen.",
    AnalysePunten:
      '1. Stelt de verkoper open vragen op de verschillende niveaus?\n2. Gebruikt de verkoper verdiepende vragen, zoals "waarom" vragen?\n3. Leidt het gesprek naar specifieke antwoorden die inzicht geven in het type klant?',
    GoedVoorbeeld:
      "De verkoper stelt open en verdiepende vragen die de echte behoefte en het klanttype onthullen.",
    DeelsGoedVoorbeeld:
      'De verkoper stelt open vragen maar mist verdiepende "waarom" vragen.',
    FoutVoorbeeld: "De verkoper stelt geen open of verdiepende vragen.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper stelt open en verdiepende vragen, waarbij de klant specifieke antwoorden geeft die inzicht bieden in de echte behoefte en het type klant.",
    ToekenningPuntenDeelsGoed:
      'De verkoper stelt open vragen, maar mist verdiepende vragen zoals "waarom" vragen, waardoor de klantbehoefte niet volledig wordt begrepen.',
    ToekenningPuntenFout:
      "De verkoper stelt geen open of verdiepende vragen, waardoor er geen inzicht wordt verkregen in de echte behoefte of het type klant.",
  },
  {
    Fase: 3,
    Titel: "USP to UBR connection",
    Doel: "Het doel van USP to UBR connection is om de unieke verkooppunten (USP's) te vertalen naar klantgerichte voordelen (UBR's).",
    AnalysePunten:
      "Gebruikt de verkoper relevante USP's die aansluiten bij de eerder benoemde behoeften van de klant?",
    GoedVoorbeeld: "De verkoper vertaalt USPs effectief naar UBRs.",
    DeelsGoedVoorbeeld:
      "De verkoper benoemt USPs maar verbindt deze niet volledig.",
    FoutVoorbeeld:
      "De verkoper presenteert USPs zonder enige koppeling aan klantbehoeften.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper vertaalt USPs effectief naar UBRs die aansluiten bij de klantbehoeften en onderbouwt dit met voorbeelden of resultaten.",
    ToekenningPuntenDeelsGoed:
      "De verkoper benoemt USPs, maar verbindt deze niet volledig aan de klantbehoeften of laat relevante voorbeelden achterwege.",
    ToekenningPuntenFout:
      "De verkoper presenteert USPs zonder enige koppeling aan de klantbehoeften, waardoor de meerwaarde onduidelijk blijft.",
  },
  {
    Fase: 3,
    Titel: "Result",
    Doel: 'Het doel van "result" is om het resultaat van de USP duidelijk te maken.',
    AnalysePunten:
      "1. Wordt het resultaat van de USP expliciet en helder aan de klant uitgelegd?\n2. Sluit het benoemde resultaat direct aan bij de specifieke behoeften en verwachtingen van de klant?\n3. Gebruikt de verkoper duidelijke taal en voorbeelden om het resultaat tastbaar te maken?",
    GoedVoorbeeld:
      "Het resultaat wordt helder uitgelegd en specifiek gekoppeld aan klantbehoefte.",
    DeelsGoedVoorbeeld:
      "Het resultaat wordt algemeen benoemd maar mist koppeling.",
    FoutVoorbeeld: "Er wordt geen resultaat benoemd.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "Het resultaat van de USP wordt helder uitgelegd en specifiek gekoppeld aan de klantbehoefte.",
    ToekenningPuntenDeelsGoed:
      "Het resultaat wordt algemeen benoemd, maar mist een duidelijke koppeling aan de behoeften van de klant.",
    ToekenningPuntenFout:
      "Er wordt geen resultaat benoemd of het resultaat is te vaag om relevant te zijn voor de klant.",
  },
  {
    Fase: 3,
    Titel: "Acknowledgement",
    Doel: 'Het doel van "acknowledgement" is om een expliciete bevestiging van de klant te krijgen.',
    AnalysePunten:
      "1. Vraagt de verkoper expliciet naar de instemming van de klant?\n2. Bevestigt de klant duidelijk dat zij akkoord gaan?\n3. Stelt de verkoper vervolgvragen of speelt hij in op twijfel?",
    GoedVoorbeeld:
      "De verkoper vraagt expliciet om instemming en de klant bevestigt.",
    DeelsGoedVoorbeeld:
      "De verkoper benoemt voordelen maar vraagt niet expliciet om instemming.",
    FoutVoorbeeld: "De verkoper vraagt niet om instemming.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper vraagt expliciet naar instemming, en de klant bevestigt duidelijk dat zij akkoord gaan met de voorgestelde voordelen en oplossing.",
    ToekenningPuntenDeelsGoed:
      "De verkoper benoemt de voordelen, maar vraagt niet expliciet om instemming, waardoor de klant geen duidelijke bevestiging geeft.",
    ToekenningPuntenFout:
      "De verkoper vraagt niet om instemming, en de klant geeft geen enkele vorm van bevestiging.",
  },
  {
    Fase: 4,
    Titel: "Agreement",
    Doel: 'Het doel van "agreement" is om het gesprek af te sluiten met concrete afspraken en vervolgstappen.',
    AnalysePunten:
      "1. Bevestigt de verkoper expliciet de gemaakte afspraken en de vervolgstappen?\n2. Vraagt de verkoper of de klant instemt met de voorgestelde afspraken?\n3. Sluit de verkoper het gesprek op een professionele en positieve manier af en maakt hij een vervolgafspraak?",
    GoedVoorbeeld:
      "De verkoper legt afspraken en vervolgstappen concreet vast met bevestiging.",
    DeelsGoedVoorbeeld:
      "De verkoper benoemt vervolgstappen maar mist concreetheid.",
    FoutVoorbeeld:
      "De verkoper maakt geen afspraken of vermeldt geen vervolgstappen.",
    PuntenGoed: 3,
    PuntenDeelsGoed: 1,
    PuntenFout: 0,
    ToekenningPuntenGoed:
      "De verkoper legt de afspraken en vervolgstappen concreet vast en vraagt expliciet om bevestiging van de klant.",
    ToekenningPuntenDeelsGoed:
      "De verkoper benoemt dat er vervolgstappen zullen zijn, maar mist concreetheid en/of vraagt niet om bevestiging.",
    ToekenningPuntenFout:
      "De verkoper maakt geen afspraken of vermeldt geen vervolgstappen, waardoor er onduidelijkheid blijft.",
  },
];

/**
 * Fase reference data per language code. The reference texts (Doel,
 * voorbeelden, toekenning) are shown in the UI alongside each phase score.
 *
 * Currently only NL exists; other languages fall back to NL. To add a
 * language: translate NL_FASE_REFERENCE (keep `Fase` and `Titel` identical —
 * they are the matching keys) and register it here, e.g. `en: EN_FASE_REFERENCE`.
 */
const FASE_REFERENCE_BY_LANG: Record<string, typeof NL_FASE_REFERENCE> = {
  nl: NL_FASE_REFERENCE,
};

function getFaseReferenceForLanguage(language: string) {
  const key = language.trim().slice(0, 2).toLowerCase();
  return FASE_REFERENCE_BY_LANG[key] || NL_FASE_REFERENCE;
}

// ---------------------------------------------------------------------------
// 1. Prompt builder
// ---------------------------------------------------------------------------

async function buildPrompt(
  gesprek: string,
  language: string,
  terminologyBlock?: string | null,
): Promise<string> {
  // The active prompt comes from the DB-backed admin editor (seeded from
  // prompt.md on first run). {{language}} appears in multiple places, so use
  // replaceAll; {{gesprek}} appears once.
  const template = await transcriptAnalysisPromptService.getActiveContent();
  let prompt = template
    .replaceAll("{{language}}", language)
    .replace("{{gesprek}}", gesprek);

  // Optional per-company terminology glossary: inject it right before the
  // transcript so the model reads it as a late, high-salience instruction.
  // Companies without a glossary pass nothing, so the prompt is unchanged.
  if (terminologyBlock) {
    const marker = "## Conversation Transcript";
    prompt = prompt.includes(marker)
      ? prompt.replace(marker, `${terminologyBlock}\n\n${marker}`)
      : `${prompt}\n\n${terminologyBlock}`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// 2. Parse LLM response — strip fences, salvage broken JSON
// ---------------------------------------------------------------------------

const MAX_JSON_PARSE_ATTEMPTS = 3;

function countUnescapedDoubleQuotes(text: string): number {
  let count = 0;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      count += 1;
    }
  }

  return count;
}

function hasBalancedBraces(text: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString && char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth < 0) return false;
  }

  return depth === 0 && !inString;
}

function detectIncompleteJson(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed.startsWith("{")) return true;
  if (!trimmed.endsWith("}")) return true;
  if (!hasBalancedBraces(trimmed)) return true;
  if (countUnescapedDoubleQuotes(trimmed) % 2 !== 0) return true;

  return false;
}

function normalizeJsonCandidate(raw: string): string {
  let text = raw.trim();

  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");

  const firstBrace = text.indexOf("{");
  if (firstBrace > 0) text = text.slice(firstBrace);

  const lastBrace = text.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < text.length - 1) {
    text = text.slice(0, lastBrace + 1);
  }

  return text;
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function throwIncompleteJsonError(raw: string): never {
  throw new Error(
    `LLM returned incomplete JSON (response truncated)\nFirst 500 chars: ${raw.slice(0, 500)}`,
  );
}

function throwMalformedJsonError(raw: string, parseError: unknown): never {
  const message =
    parseError instanceof Error ? parseError.message : String(parseError);

  throw new Error(
    `Failed to parse LLM response as JSON: ${message}\nFirst 500 chars: ${raw.slice(0, 500)}`,
  );
}

function parseResponse(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("LLM returned empty response");
  }

  const text = normalizeJsonCandidate(raw);

  if (detectIncompleteJson(text)) {
    throwIncompleteJsonError(raw);
  }

  try {
    return JSON.parse(text);
  } catch (initialError) {
    const withTrailingCommasRemoved = removeTrailingCommas(text);

    if (withTrailingCommasRemoved !== text) {
      if (detectIncompleteJson(withTrailingCommasRemoved)) {
        throwIncompleteJsonError(raw);
      }

      try {
        return JSON.parse(withTrailingCommasRemoved);
      } catch {
        // Fall through to malformed error below.
      }
    }

    if (detectIncompleteJson(text)) {
      throwIncompleteJsonError(raw);
    }

    throwMalformedJsonError(raw, initialError);
  }
}

function isRetryableParseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message.includes("LLM returned incomplete JSON") ||
    error.message.includes("Failed to parse LLM response as JSON")
  );
}

// ---------------------------------------------------------------------------
// 3. Validation helpers
// ---------------------------------------------------------------------------

// Common English/alternative → canonical Dutch mappings
const TRANSLATIONS = {
  // Sfeer
  positive: "Positief",
  positief: "Positief",
  positif: "Positief",
  positivo: "Positief",
  neutral: "Neutraal",
  neutraal: "Neutraal",
  negative: "Negatief",
  negatief: "Negatief",
  négatif: "Negatief",
  negativo: "Negatief",
  // Klanttype
  red: "Rood",
  rood: "Rood",
  rojo: "Rood",
  rouge: "Rood",
  rot: "Rood",
  rosso: "Rood",
  green: "Groen",
  groen: "Groen",
  verde: "Groen",
  vert: "Groen",
  grün: "Groen",
  blue: "Blauw",
  blauw: "Blauw",
  azul: "Blauw",
  bleu: "Blauw",
  blau: "Blauw",
  blu: "Blauw",
  yellow: "Geel",
  geel: "Geel",
  amarillo: "Geel",
  jaune: "Geel",
  gelb: "Geel",
  giallo: "Geel",
};

/** Fuzzy-match a value against an enum list. Returns the matched value or the fallback. */
function matchEnum(value, allowed, fallback, fieldName = "value") {
  if (typeof value !== "string") {
    console.warn(
      `[TranscriptAnalysis] ${fieldName} missing or not a string (got ${typeof value}), falling back to "${fallback}"`,
    );
    return fallback;
  }
  const clean = value.trim();

  // Exact match
  if (allowed.includes(clean)) return clean;

  // Case-insensitive exact
  const lower = clean.toLowerCase();
  const found = allowed.find((a) => a.toLowerCase() === lower);
  if (found) return found;

  // Translation table (handles English, Spanish, French, German, Italian)
  const translated = TRANSLATIONS[lower];
  if (translated && allowed.includes(translated)) return translated;

  // Partial / substring
  const partial = allowed.find(
    (a) => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower),
  );
  if (partial) return partial;

  console.warn(
    `[TranscriptAnalysis] Unrecognized ${fieldName} "${clean}", falling back to "${fallback}"`,
  );
  return fallback;
}

/** Normalize Conclusie: handles English "Good"/"Bad", Dutch "Goed"/"Fout", etc. */
function normalizeConclusie(value) {
  if (typeof value !== "string") return "Fout";
  const v = value.trim().toLowerCase();
  if (
    v === "goed" ||
    v === "good" ||
    v === "correct" ||
    v === "ja" ||
    v === "yes"
  )
    return "Goed";
  return "Fout";
}

/** Clamp a number to [min, max]. If not a number, return fallback. */
function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function ensureString(value, fallback = "") {
  if (typeof value === "string" && value.trim()) return value;
  if (value != null) return String(value);
  return fallback;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

// ---------------------------------------------------------------------------
// 4. Validate full LLM output — fix everything that can be fixed
// ---------------------------------------------------------------------------

function validate(data) {
  if (typeof data !== "object" || data === null) {
    throw new Error("LLM response is not an object");
  }

  const result = {};

  // GeenSalesgesprek — true when the transcript is not an analyzable sales conversation
  result.GeenSalesgesprek = data.GeenSalesgesprek === true;

  // Sfeer
  result.SfeerToelichting = ensureString(data.SfeerToelichting, "");
  result.Sfeer = matchEnum(data.Sfeer, VALID_SFEER, "Neutraal", "Sfeer");

  // Klanttype
  result.Klanttype = matchEnum(
    data.Klanttype,
    VALID_KLANTTYPE,
    "Groen",
    "Klanttype",
  );

  // Verkoper
  result.Verkoper = ensureString(data.Verkoper, "");

  // Samenvatting
  result.Samenvatting = ensureString(data.Samenvatting, "");

  // Mail
  result.Mail = ensureString(data.Mail, "");

  // Leerpunten — array of 1-4 strings.
  // A non-sales conversation has no sales performance to coach, so it must have
  // NO learning points at all (empty). Enforced here in code — not left to the
  // model — and the "no learning points identified" placeholder is only used
  // for a real sales conversation where the model returned none.
  if (result.GeenSalesgesprek) {
    result.Leerpunten = [];
  } else {
    const rawLeerpunten = ensureArray(data.Leerpunten)
      .map((l) => ensureString(l))
      .filter((l) => l.length > 0)
      // Drop the model's own "no learning points" placeholder if it slipped in.
      .filter((l) => l.toLowerCase() !== "geen leerpunten geïdentificeerd");
    result.Leerpunten = rawLeerpunten.slice(0, 4);
    if (result.Leerpunten.length === 0) {
      result.Leerpunten = ["Geen leerpunten geïdentificeerd"];
    }
  }

  // Weerstanden
  result.Weerstanden = ensureArray(data.Weerstanden)
    .filter((w) => w && typeof w === "object")
    .map((w) => ({
      KlantWeerstand: ensureString(
        w.KlantWeerstand || w.Objection || w.klantWeerstand,
      ),
      VerkoperReactie: ensureString(
        w.VerkoperReactie || w.Response || w.verkoperReactie,
      ),
      Conclusie: normalizeConclusie(w.Conclusie || w.Conclusion || w.conclusie),
      Reden: ensureString(w.Reden || w.Reasoning || w.reden),
    }))
    .filter((w) => w.KlantWeerstand || w.VerkoperReactie);

  // Fases — must be exactly 15, matched by Titel
  const rawFases = ensureArray(data.Fases);

  // Build a lookup from the LLM output by lowercase Titel
  const llmFaseByTitel = new Map();
  for (const f of rawFases) {
    if (f && typeof f === "object" && f.Titel) {
      llmFaseByTitel.set(f.Titel.trim().toLowerCase(), f);
    }
  }

  // Walk the expected phases in order, pull LLM data or fill defaults
  result.Fases = EXPECTED_FASES.map((expected) => {
    const key = expected.Titel.toLowerCase();
    const llm = llmFaseByTitel.get(key);

    return {
      Fase: expected.Fase,
      Titel: expected.Titel,
      Score: llm ? clampInt(llm.Score, 0, MAX_FASE_SCORE, 0) : 0,
      Redenering: llm
        ? ensureString(llm.Redenering || llm.Reasoning)
        : "Niet beoordeeld",
    };
  });

  return result;
}

// ---------------------------------------------------------------------------
// 5. Deterministic computations
// ---------------------------------------------------------------------------

/**
 * Compute the seller's word percentage from the transcript.
 *
 * Expects lines in "Speaker: text" format. Matches the seller name using
 * normalized substring comparison so "Jan" matches "Jan de Vries".
 *
 * Returns null when the percentage cannot be determined (no speaker labels
 * in the transcript, or the seller name doesn't match any speaker) so the
 * UI can show "n/a" instead of a misleading 0%.
 */
function computePercentageVerkoper(gesprek, verkoper) {
  if (!gesprek || !verkoper) return null;

  const lines = gesprek.split("\n");
  const speakerNorm = verkoper.trim().toLowerCase();

  // Accumulate word counts per speaker
  const speakers = {};

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) continue;

    const who = line.slice(0, colonIdx).trim();
    const text = line.slice(colonIdx + 1).trim();
    if (!who || !text) continue;

    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    if (!speakers[who]) speakers[who] = 0;
    speakers[who] += words;
  }

  const entries = Object.entries(speakers);
  if (entries.length === 0) return null;

  const totalWords = entries.reduce((sum, [, count]) => sum + count, 0);
  if (totalWords === 0) return null;

  // Find the speaker that best matches `verkoper`
  // Try: exact, case-insensitive, substring
  let match = entries.find(
    ([name]) => name.trim().toLowerCase() === speakerNorm,
  );
  if (!match) {
    match = entries.find(([name]) =>
      name.trim().toLowerCase().includes(speakerNorm),
    );
  }
  if (!match) {
    match = entries.find(([name]) =>
      speakerNorm.includes(name.trim().toLowerCase()),
    );
  }

  if (!match) return null;
  return Math.round((match[1] / totalWords) * 100);
}

/**
 * Score objection handling on a 0-2 scale.
 * Returns null when there were no objections at all: in that case objection
 * handling is simply not assessable, and the total score should be based on
 * the phases alone instead of granting a free maximum bonus.
 */
function computeWeerstandenScore(weerstanden) {
  if (!weerstanden.length) return null;
  const goed = weerstanden.filter((w) => w.Conclusie === "Goed").length;
  return (goed / weerstanden.length) * 2;
}

function computeFaseScore(fases) {
  const sum = fases.reduce((s, f) => s + f.Score, 0);
  return (sum / (FASE_COUNT * MAX_FASE_SCORE)) * 5;
}

/**
 * Total score = the plain average of the 15 phase scores (each 0/1/3), scaled
 * to a 0-10 grade. Objection handling (weerstanden) does NOT count toward the
 * total.
 *
 *   Totaalscore = (sum of the 15 fase scores / (15 * 3)) * 10
 *
 * Since faseScore already equals (sum / 45) * 5, this is simply faseScore * 2.
 * Range 0.0-10.0 (0 = every part wrong; no floor).
 */
function computeTotaalscore(faseScore) {
  const raw = faseScore * 2;
  return parseFloat(Math.max(0, Math.min(10, raw)).toFixed(1));
}

// ---------------------------------------------------------------------------
// 6. Enrich Fases with static rubric data
// ---------------------------------------------------------------------------

function enrichFases(fases, referenceData) {
  const refByKey = new Map();
  for (const ref of referenceData) {
    refByKey.set(`${ref.Fase}:${ref.Titel.toLowerCase()}`, ref);
  }

  return fases.map((fase) => {
    const ref = refByKey.get(`${fase.Fase}:${fase.Titel.toLowerCase()}`);
    if (!ref) return fase;

    return {
      Score: fase.Score,
      Redenering: fase.Redenering,
      Fase: fase.Fase,
      Titel: fase.Titel,
      Doel: ref.Doel,
      AnalysePunten: ref.AnalysePunten,
      GoedVoorbeeld: ref.GoedVoorbeeld,
      DeelsGoedVoorbeeld: ref.DeelsGoedVoorbeeld,
      FoutVoorbeeld: ref.FoutVoorbeeld,
      PuntenGoed: ref.PuntenGoed,
      PuntenDeelsGoed: ref.PuntenDeelsGoed,
      PuntenFout: ref.PuntenFout,
      ToekenningPuntenGoed: ref.ToekenningPuntenGoed,
      ToekenningPuntenDeelsGoed: ref.ToekenningPuntenDeelsGoed,
      ToekenningPuntenFout: ref.ToekenningPuntenFout,
    };
  });
}

// ---------------------------------------------------------------------------
// 7. Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze a sales conversation.
 *
 * @param {string}   gesprek        The conversation transcript
 * @param {string}   language       Language code: nl, fr, de, en, it, es
 * @param {function} llm            async (prompt: string) => string — your LLM call
 * @param {object}   [options]
 * @param {Array}    [options.faseReference]  Language-specific fase reference data (defaults to NL)
 * @returns {Promise<object>}       The full analysis result matching the original API signature
 */
export async function analyze(
  gesprek: string,
  language: string,
  llm: LlmFn,
  options: {
    faseReference?: typeof NL_FASE_REFERENCE;
    /** Pre-built per-company terminology glossary block (see terminologyService). */
    terminologyBlock?: string | null;
  } = {},
) {
  if (!gesprek || typeof gesprek !== "string") {
    throw new Error("gesprek is required and must be a non-empty string");
  }
  if (!language || typeof language !== "string") {
    throw new Error("language is required");
  }
  if (typeof llm !== "function") {
    throw new Error(
      "llm must be an async function: (prompt: string) => string",
    );
  }

  const faseReference =
    options.faseReference || getFaseReferenceForLanguage(language);

  const prompt = await buildPrompt(gesprek, language, options.terminologyBlock);

  // On retries, feed the parse error and a snippet of the broken response
  // back to the model. With deterministic temperature, resending an identical
  // prompt tends to reproduce the identical broken output.
  let retryFeedback = "";

  for (let attempt = 1; attempt <= MAX_JSON_PARSE_ATTEMPTS; attempt += 1) {
    const raw = await llm(retryFeedback ? prompt + retryFeedback : prompt);

    try {
      const parsed = parseResponse(raw);
      const validated = validate(parsed);

      const percentageVerkoper = computePercentageVerkoper(
        gesprek,
        validated.Verkoper,
      );
      // Weerstanden are still analysed and returned for display, but no longer
      // contribute to the total score (the total is the phase average only).
      const faseScore = computeFaseScore(validated.Fases);
      const totaalscore = computeTotaalscore(faseScore);
      const enrichedFases = enrichFases(validated.Fases, faseReference);

      return {
        GeenSalesgesprek: validated.GeenSalesgesprek,
        Klanttype: validated.Klanttype,
        Weerstanden: validated.Weerstanden,
        Fases: enrichedFases,
        Totaalscore: validated.GeenSalesgesprek ? 0 : totaalscore,
        Sfeer: validated.Sfeer,
        SfeerToelichting: validated.SfeerToelichting,
        PercentageVerkoper: percentageVerkoper,
        Samenvatting: validated.Samenvatting,
        Mail: validated.Mail,
        Leerpunten: validated.Leerpunten,
      };
    } catch (error) {
      const isLastAttempt = attempt === MAX_JSON_PARSE_ATTEMPTS;
      const shouldRetry = !isLastAttempt && isRetryableParseError(error);

      if (shouldRetry) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[TranscriptAnalysis] JSON parse attempt ${attempt}/${MAX_JSON_PARSE_ATTEMPTS} failed:`,
          errorMessage,
        );
        retryFeedback =
          `\n\n---\n\nIMPORTANT: Your previous response could not be parsed as JSON.` +
          `\nError: ${errorMessage.slice(0, 300)}` +
          `\nStart of your previous response: ${typeof raw === "string" ? raw.slice(0, 300) : "(empty)"}` +
          `\nRespond again with the complete, valid JSON object only — no markdown fences, no commentary, and make sure the JSON is fully closed.`;
        continue;
      }

      throw error;
    }
  }

  throw new Error("Analysis failed after JSON parse retries");
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export {
  parseResponse,
  validate,
  detectIncompleteJson,
  isRetryableParseError,
  computePercentageVerkoper,
  computeWeerstandenScore,
  computeFaseScore,
  computeTotaalscore,
  enrichFases,
  buildPrompt,
  NL_FASE_REFERENCE,
  EXPECTED_FASES,
};
