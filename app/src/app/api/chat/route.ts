import { NextResponse } from "next/server";
import {
  getSession,
  getHistory,
  pushMessage,
  clearSessionHistory,
  endSession,
} from "@/lib/salescoach/sessionStore";
import OpenAI from "openai";
import {
  getAanbodFasesValidationContext,
  getKnowledgeFor,
  loadKnowledge,
} from "@/lib/salescoach/knowledge";
import {
  buildObjectionsWelcomeBase,
  buildStandardPhaseWelcomeGreeting,
} from "@/lib/salescoach/replitGreetings";
import {
  CLARIFICATION_MESSAGES,
  isPracticeAgainQuestion,
  OBJECTION_CLOSURE_QUESTIONS,
  PRACTICE_AGAIN_QUESTIONS,
} from "@/lib/salescoach/chatClosure";
import {
  PHASE_PROMPTS,
  normalizeLang,
  buildSystemPrompt,
  type SupportedLang,
} from "@/lib/salescoach/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Multilingual response templates
const FRESH_START_MESSAGES: Record<SupportedLang, string> = {
  nl: "Prima! Laten we opnieuw beginnen. Veel succes!",
  en: "Great! Let's start fresh. Good luck!",
  de: "Prima! Lass uns neu anfangen. Viel Erfolg!",
  fr: "Parfait! Recommençons. Bonne chance!",
  it: "Perfetto! Ricominciamo. Buona fortuna!",
  es: "¡Perfecto! Empecemos de nuevo. ¡Buena suerte!",
};

const GOODBYE_MESSAGES: Record<SupportedLang, string> = {
  nl: "Bedankt voor het oefenen! Tot de volgende keer!",
  en: "Thanks for practicing! See you next time!",
  de: "Danke fürs Üben! Bis zum nächsten Mal!",
  fr: "Merci d'avoir pratiqué! À la prochaine!",
  it: "Grazie per aver praticato! Alla prossima!",
  es: "¡Gracias por practicar! ¡Hasta la próxima!",
};

const APPROVAL_MESSAGES: Record<SupportedLang, string[]> = {
  nl: [
    "Ja, dit klinkt goed",
    "JA, dit is wat ik bedoel",
    "JA, dit ben ik met je eens",
    "Ja precies",
    "Klopt",
  ],
  en: [
    "Yes, this sounds good",
    "YES, this is what I mean",
    "YES, I agree",
    "Exactly",
    "That's right",
  ],
  de: [
    "Ja, das klingt gut",
    "JA, das meine ich",
    "JA, da stimme ich zu",
    "Genau",
    "Stimmt",
  ],
  fr: [
    "Oui, ça a l'air bien",
    "OUI, c'est ce que je veux dire",
    "OUI, je suis d'accord",
    "Exactement",
  ],
  it: [
    "Sì, suona bene",
    "SÌ, questo è quello che intendo",
    "SÌ, sono d'accordo",
    "Esattamente",
  ],
  es: [
    "Sí, esto suena bien",
    "SÍ, esto es lo que quiero decir",
    "SÍ, estoy de acuerdo",
    "Exactamente",
  ],
};

const DOUBT_MESSAGES: Record<SupportedLang, string[]> = {
  nl: [
    "Ik weet het niet",
    "Ik dacht aan iets anders",
    "Ik bedoelde het anders",
    "Hmm, niet helemaal",
  ],
  en: [
    "I don't know",
    "I was thinking of something else",
    "I meant something different",
    "Hmm, not quite",
  ],
  de: [
    "Ich weiß nicht",
    "Ich dachte an etwas anderes",
    "Ich meinte etwas anderes",
    "Hmm, nicht ganz",
  ],
  fr: [
    "Je ne sais pas",
    "Je pensais à autre chose",
    "Je voulais dire autre chose",
    "Hmm, pas vraiment",
  ],
  it: [
    "Non lo so",
    "Pensavo a qualcos'altro",
    "Intendevo qualcos'altro",
    "Hmm, non proprio",
  ],
  es: [
    "No lo sé",
    "Estaba pensando en otra cosa",
    "Quise decir otra cosa",
    "Hmm, no exactamente",
  ],
};

const NEXT_OBJECTION_GREETINGS: Record<SupportedLang, string> = {
  nl: "Hier komt de volgende.",
  en: "Here comes the next one.",
  de: "Hier kommt die nächste.",
  fr: "Voici la suivante.",
  it: "Ecco la prossima.",
  es: "Aquí viene la siguiente.",
};

const CLOSING_MESSAGES: Record<SupportedLang, string> = {
  nl: "Prima! Succes met je volgende gesprekken. Je kunt altijd terugkomen om meer te oefenen.",
  en: "Great! Good luck with your next conversations. You can always come back to practice more.",
  de: "Prima! Viel Erfolg bei deinen nächsten Gesprächen. Du kannst jederzeit zurückkommen, um mehr zu üben.",
  fr: "Parfait! Bonne chance pour tes prochaines conversations. Tu peux toujours revenir pour pratiquer davantage.",
  it: "Perfetto! Buona fortuna con le tue prossime conversazioni. Puoi sempre tornare per esercitarti di più.",
  es: "¡Genial! Buena suerte con tus próximas conversaciones. Siempre puedes volver para practicar más.",
};

// Helper functions
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function isYesResponse(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  const yesWords = [
    "ja",
    "yes",
    "sí",
    "si",
    "sì",
    "oui",
    "graag",
    "please",
    "jawel",
    "zeker",
  ];
  return (
    yesWords.includes(trimmed) ||
    yesWords.some(
      (word) => trimmed.startsWith(word + " ") || trimmed.startsWith(word + ",")
    )
  );
}

function isNoResponse(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  const noWords = [
    "nee",
    "no",
    "non",
    "nein",
    "niet",
    "stop",
    "klaar",
    "genoeg",
    "dank",
    "bedankt",
    "thanks",
  ];
  return (
    noWords.includes(trimmed) ||
    noWords.some(
      (word) => trimmed.startsWith(word + " ") || trimmed.startsWith(word + ",")
    )
  );
}

/** Replit-aligned: last avatar message looks like a customer doubt/objection after an offer. */
function isAanbodObjectionAvatarMessage(lastAvatarMessage: string): boolean {
  const t = lastAvatarMessage;
  return (
    /\bmaar\b/i.test(t) ||
    /\bechter\b/i.test(t) ||
    /twijfel/i.test(t) ||
    /niet.*overtuigd/i.test(t) ||
    /niet.*zeker/i.test(t) ||
    /vraag me af/i.test(t) ||
    /begrijp.*niet/i.test(t) ||
    /niet helemaal/i.test(t) ||
    /zorgen/i.test(t) ||
    /hoe.*(?:zit|werkt|gaat)/i.test(t) ||
    /waarom/i.test(t) ||
    /\bbut\b/i.test(t) ||
    /\bhowever\b/i.test(t) ||
    /not.*convinced/i.test(t) ||
    /not.*sure/i.test(t) ||
    /wonder if/i.test(t) ||
    /don't.*understand/i.test(t) ||
    /concerned/i.test(t) ||
    /worried/i.test(t) ||
    /weet.*niet/i.test(t) ||
    /don't know/i.test(t)
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  try {
    console.log("[SalesCoachChat] incoming", {
      sessionId: (body as any)?.sessionId,
      hasMessage: Boolean((body as any)?.message),
      isWelcome: (body as any)?.message === "__WELCOME__",
      language: (body as any)?.language || "en",
      timestamp: Date.now(),
    });
  } catch {}

  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    message,
    language = "en",
    sessionId,
  } = body as { message: string; language?: string; sessionId?: string };
  const session = sessionId ? getSession(sessionId) : undefined;
  const lang = normalizeLang(language || session?.language || "en");
  const phaseKey = (session?.phase || "opening").toLowerCase();
  const isWelcomeMessage = message === "__WELCOME__";
  const isObjectionsPhase = phaseKey === "objections";
  const isOfferPhase = phaseKey === "offer";

  const apiKey = process.env.OPENAI_API_KEY;

  // Load knowledge for all cases
  try {
    await loadKnowledge(false);
  } catch {}
  const knowledge = await getKnowledgeFor(lang, phaseKey);

  // ========================================
  // WELCOME MESSAGE HANDLING
  // ========================================
  if (isWelcomeMessage && sessionId) {
    let reply: string;
    if (isObjectionsPhase) {
      reply = buildObjectionsWelcomeBase(lang);
      if (knowledge.objections && knowledge.objections.length > 0) {
        const randomObjection = getRandomItem(knowledge.objections);
        reply = `${reply} ${randomObjection}`;
        console.log(
          `🎯 [Weerstanden] Selected random objection: "${randomObjection}"`
        );
      }
    } else {
      reply = buildStandardPhaseWelcomeGreeting(lang, phaseKey);
    }

    // Replit parity: welcome is NOT stored in session history (see AI-Sales-trainer-avatar routes.ts — save only if !isWelcomeMessage).
    return NextResponse.json({ reply });
  }

  // Get conversation history (snapshot before we push the new user message)
  const liveHistory = sessionId ? getHistory(sessionId) : [];
  const history = [...liveHistory];
  const lastAvatarMessage =
    history.filter((msg) => msg.role === "assistant").pop()?.content || "";

  // ========================================
  // PRACTICE-AGAIN FLOW (applies to all phases)
  // ========================================
  if (isPracticeAgainQuestion(lastAvatarMessage) && !isWelcomeMessage) {
    console.log("🔄 Handling practice-again response");

    // Save user message first
    if (sessionId) {
      pushMessage(sessionId, { role: "user", content: String(message || "") });
    }

    if (isYesResponse(message) && !isNoResponse(message)) {
      // YES - reset conversation and start fresh
      console.log("✅ User wants to practice again - resetting conversation");

      if (sessionId) {
        clearSessionHistory(sessionId);
      }

      let freshReply = FRESH_START_MESSAGES[lang];

      // For objections phase, add a new random objection
      if (
        isObjectionsPhase &&
        knowledge.objections &&
        knowledge.objections.length > 0
      ) {
        const randomObjection = getRandomItem(knowledge.objections);
        freshReply = `${NEXT_OBJECTION_GREETINGS[lang]} ${randomObjection}`;
        console.log(
          `🎯 [Weerstanden] New random objection: "${randomObjection}"`
        );
      }

      if (sessionId) {
        pushMessage(sessionId, { role: "assistant", content: freshReply });
      }

      return NextResponse.json({
        reply: freshReply,
        sessionId,
        sessionReset: true,
      });
    } else if (isNoResponse(message)) {
      // NO - say goodbye and end session
      console.log("👋 User doesn't want to practice again - ending session");

      const goodbyeReply = GOODBYE_MESSAGES[lang];

      if (sessionId) {
        pushMessage(sessionId, { role: "assistant", content: goodbyeReply });
        endSession(sessionId);
      }

      return NextResponse.json({
        reply: goodbyeReply,
        sessionId,
        sessionEnded: true,
      });
    } else {
      // Unclear response - ask again
      console.log("❓ Unclear response to practice-again question");

      const clarificationReply = CLARIFICATION_MESSAGES[lang];

      if (sessionId) {
        pushMessage(sessionId, {
          role: "assistant",
          content: clarificationReply,
        });
      }

      return NextResponse.json({ reply: clarificationReply, sessionId });
    }
  }

  // Save user message BEFORE processing
  if (sessionId && !isWelcomeMessage) {
    pushMessage(sessionId, { role: "user", content: String(message || "") });
    console.log("💾 User message saved to session");
  }

  // ========================================
  // OBJECTIONS (WEERSTANDEN) PHASE LOGIC
  // ========================================
  if (isObjectionsPhase && !isWelcomeMessage && apiKey) {
    // In Weerstanden phase, we ALWAYS give direct feedback (never act as customer)
    // The flow is: Avatar presents objection → User responds → Avatar gives feedback → Ask if want more
    console.log(
      `🎓 [Weerstanden] Processing response. History length: ${history.length}`
    );

    const client = new OpenAI({ apiKey });

    // Build feedback prompt with objection rules INCLUDING good/bad examples from Excel
    const objectionRulesText =
      knowledge.objectionRules && knowledge.objectionRules.length > 0
        ? knowledge.objectionRules
            .map(
              (rule, idx) =>
                `${idx + 1}. WEERSTAND: "${rule.objection}"
   ✅ GOED VOORBEELD: "${rule.goodExample}"
   ❌ FOUT VOORBEELD: "${rule.badExample}"`
            )
            .join("\n\n")
        : knowledge.objections
            ?.map((obj, idx) => `${idx + 1}. ${obj}`)
            .join("\n") || "";

    console.log(
      `📚 [Weerstanden] Using ${
        knowledge.objectionRules?.length || 0
      } objection rules with examples`
    );

    // Snapshot is before this request's user message was pushed — Replit: first weerstanden reply when length === 0.
    const isFirstWeerstandenUserTurn = history.length === 0;
    const messageJson = JSON.stringify(String(message ?? ""));
    const lastAvatarJson = JSON.stringify(lastAvatarMessage);

    const objectionsPromptPrefix: Record<SupportedLang, string> = {
      nl: `CONTEXT — Wat de klant/avatar zojuist letterlijk zei:\n${lastAvatarJson}\n${
        isFirstWeerstandenUserTurn && !lastAvatarMessage
          ? "LET OP: De openingsweerstand werd door de avatar uitgesproken maar staat niet in dit chattranscript (zoals in Replit). Beoordeel de verkoper-reactie tegen de weerstandenlijst hieronder.\n"
          : ""
      }${
        isFirstWeerstandenUserTurn && lastAvatarMessage
          ? "LET OP: Dit is het eerste antwoord van de verkoper na de openingsweerstand.\n"
          : ""
      }\n`,
      en: `CONTEXT — Verbatim customer/avatar line just now:\n${lastAvatarJson}\n${
        isFirstWeerstandenUserTurn && !lastAvatarMessage
          ? "NOTE: The opening objection was spoken by the avatar but is not in this chat transcript (Replit behavior). Evaluate the salesperson against the objection list below.\n"
          : ""
      }${
        isFirstWeerstandenUserTurn && lastAvatarMessage
          ? "NOTE: This is the salesperson's first reply after the opening objection.\n"
          : ""
      }\n\n`,
      de: `CONTEXT — Wörtlich, was der Kunde/Avatar gerade sagte:\n${lastAvatarJson}\n${
        isFirstWeerstandenUserTurn && !lastAvatarMessage
          ? "HINWEIS: Die erste Einwandzeile sprach der Avatar, steht aber nicht in diesem Chat (Replit). Bewerte anhand der Liste unten.\n"
          : ""
      }${
        isFirstWeerstandenUserTurn && lastAvatarMessage
          ? "HINWEIS: Erste Antwort des Verkäufers nach der ersten Einwand-Öffnung.\n"
          : ""
      }\n\n`,
      fr: `CONTEXT — Texte exact du client/avatar à l’instant:\n${lastAvatarJson}\n${
        isFirstWeerstandenUserTurn && !lastAvatarMessage
          ? "NOTE : L’objection d’ouverture a été dite par l’avatar mais n’est pas dans ce transcript (comme Replit). Évalue à partir de la liste ci-dessous.\n"
          : ""
      }${
        isFirstWeerstandenUserTurn && lastAvatarMessage
          ? "NOTE : Première réponse du vendeur après l’objection d’ouverture.\n"
          : ""
      }\n\n`,
      it: `CONTEXT — Testo esatto appena detto dal cliente/avatar:\n${lastAvatarJson}\n${
        isFirstWeerstandenUserTurn && !lastAvatarMessage
          ? "NOTA: L’obiezione iniziale è stata detta dall’avatar ma non compare in questo transcript (Replit). Valuta usando l’elenco sotto.\n"
          : ""
      }${
        isFirstWeerstandenUserTurn && lastAvatarMessage
          ? "NOTA: Prima risposta del venditore dopo l’obiezione di apertura.\n"
          : ""
      }\n\n`,
      es: `CONTEXT — Texto exacto que acaba de decir el cliente/avatar:\n${lastAvatarJson}\n${
        isFirstWeerstandenUserTurn && !lastAvatarMessage
          ? "NOTA: La objeción inicial la dijo el avatar pero no está en este transcript (Replit). Evalúa con la lista de abajo.\n"
          : ""
      }${
        isFirstWeerstandenUserTurn && lastAvatarMessage
          ? "NOTA: Primera respuesta del vendedor tras la objeción inicial.\n"
          : ""
      }\n\n`,
    };

    const prefix =
      objectionsPromptPrefix[lang] || objectionsPromptPrefix.en;

    const feedbackPrompts: Record<SupportedLang, string> = {
      nl: `${prefix}Je bent een sales trainer die een verkoper traint in het omgaan met weerstanden.

WEERSTANDEN MET GOEDE EN FOUTE VOORBEELDEN:
${objectionRulesText}

De verkoper heeft zojuist gereageerd op een weerstand.
Verkoper's reactie: ${messageJson}

INSTRUCTIES:
1. Bepaal welke weerstand van toepassing is
2. Vergelijk de reactie met het GOEDE en FOUTE voorbeeld
3. Als de reactie GOED is (lijkt op het goede voorbeeld):
   → Start met "✅ Goed:" en leg uit waarom (1-2 zinnen)
4. Als de reactie FOUT is (lijkt op het foute voorbeeld of slechter):
   → Start met "❌ Fout:" en geef de reden
   → Voeg toe: "Een betere reactie zou zijn: [KOPIEER HIER HET GOEDE VOORBEELD]"

KRITISCH: Bij een foute reactie MOET je het exacte goede voorbeeld uit de lijst hierboven gebruiken!

Spreek ALLEEN in het Nederlands. Wees direct en constructief.`,
      en: `${prefix}You are a sales trainer coaching a salesperson on handling objections.

OBJECTIONS WITH GOOD AND BAD EXAMPLES:
${objectionRulesText}

The salesperson just responded to an objection.
Salesperson's response: ${messageJson}

INSTRUCTIONS:
1. Determine which objection applies
2. Compare the response with the GOOD and BAD example
3. If the response is GOOD (similar to the good example):
   → Start with "✅ Good:" and explain why (1-2 sentences)
4. If the response is BAD (similar to the bad example or worse):
   → Start with "❌ Bad:" and give the reason
   → Add: "A better response would be: [COPY THE GOOD EXAMPLE HERE]"

CRITICAL: For a bad response, you MUST use the exact good example from the list above!

Speak ONLY in English. Be direct and constructive.`,
      de: `${prefix}Du bist ein Verkaufstrainer, der einen Verkäufer im Umgang mit Einwänden coacht.

EINWÄNDE MIT GUTEN UND SCHLECHTEN BEISPIELEN:
${objectionRulesText}

Der Verkäufer hat gerade auf einen Einwand reagiert.
Antwort des Verkäufers: ${messageJson}

ANWEISUNGEN:
1. Bestimme, welcher Einwand zutrifft
2. Vergleiche die Reaktion mit dem GUTEN und SCHLECHTEN Beispiel
3. Wenn die Reaktion GUT ist (ähnlich dem guten Beispiel):
   → Beginne mit "✅ Gut:" und erkläre warum (1-2 Sätze)
4. Wenn die Reaktion SCHLECHT ist (ähnlich dem schlechten Beispiel oder schlechter):
   → Beginne mit "❌ Schlecht:" und gib den Grund an
   → Füge hinzu: "Eine bessere Reaktion wäre: [KOPIERE DAS GUTE BEISPIEL HIERHIN]"

KRITISCH: Bei einer schlechten Reaktion MUSST du das genaue gute Beispiel aus der Liste oben verwenden!

Sprich NUR auf Deutsch. Sei direkt und konstruktiv.`,
      fr: `${prefix}Tu es un formateur commercial qui coache un vendeur sur la gestion des objections.

OBJECTIONS AVEC BONS ET MAUVAIS EXEMPLES:
${objectionRulesText}

Le vendeur vient de répondre à une objection.
Réponse du vendeur: ${messageJson}

INSTRUCTIONS:
1. Détermine quelle objection s'applique
2. Compare la réponse avec le BON et le MAUVAIS exemple
3. Si la réponse est BONNE (similaire au bon exemple):
   → Commence par "✅ Bon:" et explique pourquoi (1-2 phrases)
4. Si la réponse est MAUVAISE (similaire au mauvais exemple ou pire):
   → Commence par "❌ Mauvais:" et donne la raison
   → Ajoute: "Une meilleure réponse serait: [COPIE LE BON EXEMPLE ICI]"

CRITIQUE: Pour une mauvaise réponse, tu DOIS utiliser l'exemple exact de la liste ci-dessus!

Parle UNIQUEMENT en français. Sois direct et constructif.`,
      it: `${prefix}Sei un formatore di vendita che allena un venditore sulla gestione delle obiezioni.

OBIEZIONI CON ESEMPI BUONI E CATTIVI:
${objectionRulesText}

Il venditore ha appena risposto a un'obiezione.
Risposta del venditore: ${messageJson}

ISTRUZIONI:
1. Determina quale obiezione si applica
2. Confronta la risposta con l'esempio BUONO e CATTIVO
3. Se la risposta è BUONA (simile all'esempio buono):
   → Inizia con "✅ Buono:" e spiega perché (1-2 frasi)
4. Se la risposta è CATTIVA (simile all'esempio cattivo o peggio):
   → Inizia con "❌ Cattivo:" e dai il motivo
   → Aggiungi: "Una risposta migliore sarebbe: [COPIA L'ESEMPIO BUONO QUI]"

CRITICO: Per una risposta cattiva, DEVI usare l'esempio esatto dalla lista sopra!

Parla SOLO in italiano. Sii diretto e costruttivo.`,
      es: `${prefix}Eres un formador de ventas que entrena a un vendedor en el manejo de objeciones.

OBJECIONES CON EJEMPLOS BUENOS Y MALOS:
${objectionRulesText}

El vendedor acaba de responder a una objeción.
Respuesta del vendedor: ${messageJson}

INSTRUCCIONES:
1. Determina qué objeción aplica
2. Compara la respuesta con el ejemplo BUENO y MALO
3. Si la respuesta es BUENA (similar al ejemplo bueno):
   → Empieza con "✅ Bueno:" y explica por qué (1-2 frases)
4. Si la respuesta es MALA (similar al ejemplo malo o peor):
   → Empieza con "❌ Malo:" y da la razón
   → Añade: "Una mejor respuesta sería: [COPIA EL EJEMPLO BUENO AQUÍ]"

CRÍTICO: ¡Para una respuesta mala, DEBES usar el ejemplo exacto de la lista de arriba!

Habla SOLO en español. Sé directo y constructivo.`,
    };

    const objectionFeedbackUserMessages: Record<SupportedLang, string> = {
      nl: `Beoordeel de reactie van de verkoper op de weerstand. Gebruik de CONTEXT en de regels hierboven.`,
      en: `Evaluate the salesperson's reply to the objection using the CONTEXT and rules above.`,
      de: `Bewerte die Antwort des Verkäufers auf den Einwand anhand des CONTEXT und der Regeln oben.`,
      fr: `Évalue la réponse du vendeur à l’objection en utilisant le CONTEXT et les règles ci-dessus.`,
      it: `Valuta la risposta del venditore all’obiezione usando il CONTEXT e le regole sopra.`,
      es: `Evalúa la respuesta del vendedor a la objeción usando el CONTEXT y las reglas de arriba.`,
    };

    try {
      const feedbackResponse = await client.chat.completions.create({
        model: session?.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: feedbackPrompts[lang] },
          {
            role: "user",
            content:
              objectionFeedbackUserMessages[lang] ||
              objectionFeedbackUserMessages.en,
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      });

      const feedbackText =
        feedbackResponse.choices[0]?.message?.content ||
        "Feedback niet beschikbaar.";
      const reply = `${feedbackText}\n\n${OBJECTION_CLOSURE_QUESTIONS[lang]}`;

      if (sessionId) {
        pushMessage(sessionId, { role: "assistant", content: reply });
      }

      console.log(
        "✅ [Weerstanden] Feedback generated and closure question added"
      );
      return NextResponse.json({ reply, sessionId });
    } catch (error) {
      console.error("[Weerstanden] Feedback generation failed", error);
      // Return error message instead of falling through to default handling
      const errorReply = `Er is een fout opgetreden bij het genereren van feedback. ${OBJECTION_CLOSURE_QUESTIONS[lang]}`;
      if (sessionId) {
        pushMessage(sessionId, { role: "assistant", content: errorReply });
      }
      return NextResponse.json({ reply: errorReply, sessionId });
    }
  }

  // ========================================
  // OFFER (AANBOD) PHASE LOGIC - UBR/USP VALIDATION + OBJECTION HANDLING (Replit parity)
  // ========================================
  if (isOfferPhase && !isWelcomeMessage && apiKey) {
    const isFirstOfferResponse = history.length === 0;
    const isAfterAanbodObjection =
      history.length >= 2 &&
      isAanbodObjectionAvatarMessage(lastAvatarMessage);

    const offerContextSnippet = await getAanbodFasesValidationContext(lang);
    const client = new OpenAI({ apiKey });

    // --- First seller utterance in offer phase: UBR + USP + result validation ---
    if (isFirstOfferResponse) {
      console.log(
        `🎁 [Aanbod] UBR/USP validation (first offer turn) contextLen=${offerContextSnippet.length}`
      );

      const validationPrompts: Record<SupportedLang, string> = {
        nl: `Je bent een sales trainer die GENEREUS beoordeelt of een verkoper een goede Aanbod/Presentatie heeft gegeven.

⚠️ BELANGRIJK: Spraak-naar-tekst kan bevestigingsvragen afkappen! Als elementen 1-4 GOED zijn → altijd AKKOORD, ook zonder perfecte bevestigingsvraag.

CHECK OF DEZE ELEMENTEN AANWEZIG ZIJN:
1. UBR (Unieke Bedrijfs Reden) - Is er iets unieks genoemd specifiek voor dit bedrijf/klant?
2. USP (Unique Selling Point) - Is er een duidelijk voordeel/onderscheidend punt?
3. KOPPELING - Zijn UBR en USP logisch verbonden in de presentatie?
4. RESULTAAT - Is er een concreet resultaat/impact genoemd?
5. BEVESTIGING - Vraagt de verkoper om akkoord? (NIET VERPLICHT als 1-4 duidelijk goed zijn!)${offerContextSnippet}

PRESENTATIE VAN VERKOPER: "${message}"

BESLISSING: Als elementen 1, 2, 3, EN 4 aanwezig zijn → "AKKOORD" (bevestiging niet verplicht!)
Anders → "WEERSTAND"

Antwoord ALLEEN met: AKKOORD of WEERSTAND (geen uitleg)`,
        en: `You are a sales trainer GENEROUSLY evaluating if a salesperson gave a good Offer/Presentation.

⚠️ IMPORTANT: Speech-to-text may cut off confirmation questions! If elements 1-4 are GOOD, ALWAYS output APPROVED, even without a perfect confirmation question.

CHECK IF THESE ELEMENTS ARE PRESENT:
1. UBR (Unique Business Reason) - Is something unique mentioned specific to this company/customer?
2. USP (Unique Selling Point) - Is there a clear benefit/differentiating point?
3. CONNECTION - Are UBR and USP logically connected in the presentation?
4. RESULT - Is a concrete result/impact mentioned?
5. CONFIRMATION - Does the salesperson ask for agreement? (NOT REQUIRED if 1-4 are clearly good!)${offerContextSnippet}

SALESPERSON'S PRESENTATION: "${message}"

DECISION: If elements 1, 2, 3, AND 4 are present → "APPROVED" (confirmation NOT required!)
Otherwise → "DOUBT"

Answer ONLY with: APPROVED or DOUBT (no explanation)`,
        de: `Sie sind ein Verkaufstrainer, der GROSSZÜGIG beurteilt, ob ein Verkäufer ein gutes Angebot gegeben hat.

⚠️ WICHTIG: Sprache-zu-Text kann Bestätigungsfragen abschneiden! Wenn Elemente 1-4 GUT sind → immer ZUSTIMMUNG.${offerContextSnippet}

PRÜFEN SIE, OB DIESE ELEMENTE VORHANDEN SIND:
1. UBR - Ist etwas Einzigartiges erwähnt, das für dieses Unternehmen/diesen Kunden spezifisch ist?
2. USP - Gibt es einen klaren Vorteil/Unterscheidungspunkt?
3. VERBINDUNG - Sind UBR und USP logisch verbunden?
4. ERGEBNIS - Wird ein konkretes Ergebnis/Auswirkung genannt?
5. BESTÄTIGUNG - Fragt der Verkäufer nach Zustimmung? (NICHT ERFORDERLICH wenn 1-4 gut sind!)

PRÄSENTATION: "${message}"

ENTSCHEIDUNG: Wenn Elemente 1, 2, 3, UND 4 vorhanden sind → "ZUSTIMMUNG", sonst → "ZWEIFEL"

Antworten Sie NUR mit: ZUSTIMMUNG oder ZWEIFEL`,
        fr: `Vous êtes un formateur commercial qui évalue GÉNÉREUSEMENT si un vendeur a fait une bonne Offre.

⚠️ IMPORTANT: La reconnaissance vocale peut couper les questions de confirmation! Si 1-4 sont BONS → toujours ACCORD.${offerContextSnippet}

VÉRIFIEZ SI CES ÉLÉMENTS SONT PRÉSENTS:
1. UBR - Quelque chose d'unique mentionné spécifique à cette entreprise/client?
2. USP - Y a-t-il un avantage clair/point différenciant?
3. CONNEXION - UBR et USP sont-ils logiquement connectés?
4. RÉSULTAT - Un résultat/impact concret est-il mentionné?
5. CONFIRMATION - Le vendeur demande-t-il un accord? (NON REQUIS si 1-4 sont bons!)

PRÉSENTATION: "${message}"

DÉCISION: Si éléments 1, 2, 3, ET 4 présents → "ACCORD", sinon → "DOUTE"

Répondez UNIQUEMENT avec: ACCORD ou DOUTE`,
        it: `Sei un formatore che valuta GENEROSAMENTE se un venditore ha dato una buona Offerta.

⚠️ IMPORTANTE: Il riconoscimento vocale può tagliare le domande di conferma! Se 1-4 sono BUONI → sempre ACCORDO.${offerContextSnippet}

VERIFICA SE QUESTI ELEMENTI SONO PRESENTI:
1. UBR - È menzionato qualcosa di unico specifico per questa azienda/cliente?
2. USP - C'è un chiaro vantaggio/punto di differenziazione?
3. COLLEGAMENTO - UBR e USP sono logicamente collegati?
4. RISULTATO - È menzionato un risultato/impatto concreto?
5. CONFERMA - Il venditore chiede un accordo? (NON RICHIESTO se 1-4 sono buoni!)

PRESENTAZIONE: "${message}"

DECISIONE: Se elementi 1, 2, 3, E 4 presenti → "ACCORDO", altrimenti → "DUBBIO"

Rispondi SOLO con: ACCORDO o DUBBIO`,
        es: `Eres un formador que evalúa GENEROSAMENTE si un vendedor dio una buena Oferta.

⚠️ IMPORTANTE: El reconocimiento de voz puede cortar preguntas de confirmación. Si 1-4 son BUENOS → siempre ACUERDO.${offerContextSnippet}

VERIFICA SI ESTOS ELEMENTOS ESTÁN PRESENTES:
1. UBR - ¿Se menciona algo único específico para esta empresa/cliente?
2. USP - ¿Hay un beneficio claro/punto diferenciador?
3. CONEXIÓN - ¿UBR y USP están lógicamente conectados?
4. RESULTADO - ¿Se menciona un resultado/impacto concreto?
5. CONFIRMACIÓN - ¿El vendedor pide acuerdo? (NO REQUERIDO si 1-4 son buenos!)

PRESENTACIÓN: "${message}"

DECISIÓN: Si elementos 1, 2, 3, Y 4 presentes → "ACUERDO", sino → "DUDA"

Responde SOLO con: ACUERDO o DUDA`,
      };

      const validationUserMessages: Record<SupportedLang, string> = {
        nl: `Beoordeel deze presentatie. Als UBR + USP + KOPPELING + RESULTAAT aanwezig zijn (1-4), geef AKKOORD. Bevestiging (5) is OPTIONEEL. Antwoord ALLEEN met het keyword.`,
        en: `Evaluate this presentation. If UBR + USP + CONNECTION + RESULT are present (1-4), give APPROVED. Confirmation (5) is OPTIONAL. Answer ONLY with the keyword.`,
        de: `Bewerten Sie diese Präsentation. Wenn UBR + USP + VERBINDUNG + ERGEBNIS vorhanden sind (1-4), geben Sie ZUSTIMMUNG. Bestätigung (5) ist OPTIONAL. Antworten Sie NUR mit dem Schlüsselwort.`,
        fr: `Évaluez cette présentation. Si UBR + USP + CONNEXION + RÉSULTAT sont présents (1-4), donnez ACCORD. Confirmation (5) est OPTIONNELLE. Répondez UNIQUEMENT avec le mot-clé.`,
        it: `Valuta questa presentazione. Se UBR + USP + COLLEGAMENTO + RISULTATO sono presenti (1-4), dai ACCORDO. Conferma (5) è OPZIONALE. Rispondi SOLO con la parola chiave.`,
        es: `Evalúa esta presentación. Si UBR + USP + CONEXIÓN + RESULTADO están presentes (1-4), da ACUERDO. Confirmación (5) es OPCIONAL. Responde SOLO con la palabra clave.`,
      };

      try {
        const validationResponse = await client.chat.completions.create({
          model: session?.model || "gpt-4o-mini",
          messages: [
            { role: "system", content: validationPrompts[lang] },
            {
              role: "user",
              content: validationUserMessages[lang] || validationUserMessages.en,
            },
          ],
          max_tokens: 50,
          temperature: 0.1,
        });

        const validation =
          validationResponse.choices[0]?.message?.content?.trim() || "";
        console.log(`📊 [Aanbod] UBR validation result: ${validation}`);

        const approvalPatterns =
          /^(AKKOORD|APPROVED|ZUSTIMMUNG|ACCORD|ACCORDO|ACUERDO)/i;
        let reply: string;

        if (approvalPatterns.test(validation)) {
          console.log("✅ [Aanbod] Good UBR+USP execution");
          const approval = getRandomItem(APPROVAL_MESSAGES[lang]);
          reply = approval + PRACTICE_AGAIN_QUESTIONS[lang];
        } else {
          console.log("⚠️ [Aanbod] Poor UBR/USP execution");
          reply = getRandomItem(DOUBT_MESSAGES[lang]);
        }

        if (sessionId) {
          pushMessage(sessionId, { role: "assistant", content: reply });
        }

        return NextResponse.json({ reply, sessionId });
      } catch (error) {
        console.error("[Aanbod] UBR validation failed", error);
        const reply = getRandomItem(DOUBT_MESSAGES[lang]);
        if (sessionId) {
          pushMessage(sessionId, { role: "assistant", content: reply });
        }
        return NextResponse.json({ reply, sessionId });
      }
    }

    // --- Seller reply after avatar showed doubt/objection: evaluate handling ---
    if (isAfterAanbodObjection) {
      console.log("🎁 [Aanbod] Objection-handling evaluation after customer doubt");

      const objectionHandlingPrompts: Record<SupportedLang, string> = {
        nl: `Je bent een sales trainer. Beoordeel of de verkoper een weerstand GOED heeft geweerlegd.

WEERSTAND VAN KLANT: "${lastAvatarMessage}"
REACTIE VAN VERKOPER: "${message}"

CRITERIA: 1) Erkent weerstand 2) NIEUWE informatie 3) UBR+USP+RESULTAAT 4) Vraagt om bevestiging
Als 3-4 criteria aanwezig → "GOED", anders → "FOUT"
Antwoord ALLEEN: GOED of FOUT`,
        en: `You are a sales trainer. Evaluate if the salesperson handled an objection WELL.

CUSTOMER OBJECTION: "${lastAvatarMessage}"
SALESPERSON RESPONSE: "${message}"

CRITERIA: 1) Acknowledges objection 2) NEW information 3) UBR+USP+RESULT 4) Asks for confirmation
If 3-4 criteria present → "GOOD", otherwise → "BAD"
Answer ONLY: GOOD or BAD`,
        de: `Sie sind ein Verkaufstrainer. Bewerten Sie, ob der Verkäufer einen Einwand GUT behandelt hat.

KUNDENEINWAND: "${lastAvatarMessage}"
VERKÄUFER-ANTWORT: "${message}"

KRITERIEN: 1) Erkennt Einwand 2) NEUE Information 3) UBR+USP+ERGEBNIS 4) Fragt nach Bestätigung
Wenn 3-4 Kriterien vorhanden → "GUT", sonst → "SCHLECHT"
Antworten Sie NUR: GUT oder SCHLECHT`,
        fr: `Vous êtes un formateur commercial. Évaluez si le vendeur a BIEN géré une objection.

OBJECTION CLIENT: "${lastAvatarMessage}"
RÉPONSE VENDEUR: "${message}"

CRITÈRES: 1) Reconnaît l'objection 2) NOUVELLE information 3) UBR+USP+RÉSULTAT 4) Demande confirmation
Si 3-4 critères présents → "BON", sinon → "MAUVAIS"
Répondez UNIQUEMENT: BON ou MAUVAIS`,
        it: `Sei un formatore di vendita. Valuta se il venditore ha gestito BENE un'obiezione.

OBIEZIONE CLIENTE: "${lastAvatarMessage}"
RISPOSTA VENDITORE: "${message}"

CRITERI: 1) Riconosce obiezione 2) NUOVA informazione 3) UBR+USP+RISULTATO 4) Chiede conferma
Se 3-4 criteri presenti → "BUONO", altrimenti → "CATTIVO"
Rispondi SOLO: BUONO o CATTIVO`,
        es: `Eres un formador de ventas. Evalúa si el vendedor manejó BIEN una objeción.

OBJECIÓN CLIENTE: "${lastAvatarMessage}"
RESPUESTA VENDEDOR: "${message}"

CRITERIOS: 1) Reconoce objeción 2) NUEVA información 3) UBR+USP+RESULTADO 4) Pide confirmación
Si 3-4 criterios presentes → "BUENO", sino → "MALO"
Responde SOLO: BUENO o MALO`,
      };

      const objectionUserMessages: Record<SupportedLang, string> = {
        nl: `Beoordeel de reactie van de verkoper. Antwoord ALLEEN met GOED of FOUT.`,
        en: `Evaluate the salesperson's response. Answer ONLY with GOOD or BAD.`,
        de: `Bewerten Sie die Antwort. Antworten Sie NUR mit GUT oder SCHLECHT.`,
        fr: `Évaluez la réponse du vendeur. Répondez UNIQUEMENT avec BON ou MAUVAIS.`,
        it: `Valuta la risposta del venditore. Rispondi SOLO con BUONO o CATTIVO.`,
        es: `Evalúa la respuesta del vendedor. Responde SOLO con BUENO o MALO.`,
      };

      try {
        const handlingResponse = await client.chat.completions.create({
          model: session?.model || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: objectionHandlingPrompts[lang],
            },
            {
              role: "user",
              content: objectionUserMessages[lang] || objectionUserMessages.en,
            },
          ],
          max_tokens: 50,
          temperature: 0.1,
        });

        const handling =
          handlingResponse.choices[0]?.message?.content?.trim() || "";
        console.log(`📊 [Aanbod] Objection handling result: ${handling}`);

        const goodHandlingPatterns = /^(GOED|GOOD|GUT|BON|BUONO|BUENO)/i;
        let reply: string;

        if (goodHandlingPatterns.test(handling)) {
          const approval = getRandomItem(APPROVAL_MESSAGES[lang]);
          reply = approval + PRACTICE_AGAIN_QUESTIONS[lang];
        } else {
          reply = getRandomItem(DOUBT_MESSAGES[lang]);
        }

        if (sessionId) {
          pushMessage(sessionId, { role: "assistant", content: reply });
        }

        return NextResponse.json({ reply, sessionId });
      } catch (error) {
        console.error("[Aanbod] Objection handling validation failed", error);
        const reply = getRandomItem(DOUBT_MESSAGES[lang]);
        if (sessionId) {
          pushMessage(sessionId, { role: "assistant", content: reply });
        }
        return NextResponse.json({ reply, sessionId });
      }
    }

    // Other offer turns: default path below uses buildSystemPrompt (strict offer mode)
  }

  // ========================================
  // DEFAULT HANDLING - OpenAI conversation
  // ========================================
  if (!apiKey) {
    const options = (
      PHASE_PROMPTS[lang]?.[phaseKey] ||
      PHASE_PROMPTS[lang]?.opening ||
      []
    ).concat(knowledge.points || []);
    const reply = options.length ? getRandomItem(options) : "Okay, go ahead.";
    if (sessionId) {
      pushMessage(sessionId, { role: "assistant", content: reply });
    }
    return NextResponse.json({ reply });
  }

  try {
    const client = new OpenAI({ apiKey });

    const knowledgeSnippet = (knowledge.points || [])
      .slice(0, 20)
      .map((s) => `- ${s}`)
      .join("\n");
    const objectionsSnippet = (knowledge.objections || [])
      .slice(0, 10)
      .map((s) => `- ${s}`)
      .join("\n");
    const system = buildSystemPrompt(
      lang,
      phaseKey,
      knowledgeSnippet,
      objectionsSnippet,
      session?.customerProfile
    );

    console.log("[SalesCoach DEBUG] ===== CHAT REQUEST =====");
    console.log("[SalesCoach DEBUG] Session found:", !!session);
    console.log("[SalesCoach DEBUG] Customer profile:", session?.customerProfile || "NONE");
    console.log("[SalesCoach DEBUG] Phase:", phaseKey);
    console.log("[SalesCoach DEBUG] Language:", lang);
    console.log("[SalesCoach DEBUG] Model:", session?.model || "gpt-4o-mini");
    console.log("[SalesCoach DEBUG] System prompt length:", system.length);
    console.log("[SalesCoach DEBUG] Has FORBIDDEN in prompt:", system.includes("FORBIDDEN BEHAVIORS"));
    console.log("[SalesCoach DEBUG] Has profile context in prompt:", system.includes("CUSTOMER PROFILE CHARACTERISTICS"));
    console.log("[SalesCoach DEBUG] Knowledge points:", (knowledge.points || []).length);
    console.log("[SalesCoach DEBUG] Objections:", (knowledge.objections || []).length);
    console.log("[SalesCoach DEBUG] History length:", history.length);
    console.log("[SalesCoach DEBUG] User message:", message);
    console.log("[SalesCoach DEBUG] System prompt first 500 chars:", system.substring(0, 500));
    console.log("[SalesCoach DEBUG] ========================");

    const messages: any[] = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: String(message || "") },
    ];

    const completion = await client.chat.completions.create({
      model: session?.model || "gpt-4o-mini",
      messages,
      temperature: 0.3,
      max_tokens: 150,
    });

    const reply = completion.choices?.[0]?.message?.content || "Ok.";
    console.log("[SalesCoach DEBUG] OpenAI reply:", reply);

    if (sessionId) {
      pushMessage(sessionId, { role: "assistant", content: reply });
    }

    return NextResponse.json({ reply, sessionId });
  } catch (error) {
    console.error("/api/chat OpenAI error", error);
    const options = (
      PHASE_PROMPTS[lang]?.[phaseKey] ||
      PHASE_PROMPTS[lang]?.opening ||
      []
    ).concat(knowledge.points || []);
    const reply = options.length ? getRandomItem(options) : "Okay, go ahead.";
    if (sessionId) {
      pushMessage(sessionId, { role: "assistant", content: reply });
    }
    return NextResponse.json({ reply });
  }
}
