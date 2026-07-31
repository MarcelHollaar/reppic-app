import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getHistory, getSession } from "@/lib/salescoach/sessionStore";
import { loadKnowledge, getKnowledgeFor } from "@/lib/salescoach/knowledge";
import { normalizeLang } from "@/lib/salescoach/prompts";
import type {
  FeedbackPhaseId,
  SalesCoachFeedback,
  SalesCoachFeedbackPhase,
} from "@/types/salescoach";

const FEEDBACK_PHASES: FeedbackPhaseId[] = [
  "opening",
  "needs_analysis",
  "offer",
  "agreement",
];
const FEEDBACK_ELIGIBLE_PHASES = new Set(FEEDBACK_PHASES);
const ROLE_NAMES: Record<string, { seller: string; customer: string }> = {
  en: { seller: "Seller", customer: "Customer" },
  nl: { seller: "Verkoper", customer: "Klant" },
  de: { seller: "Verkäufer", customer: "Kunde" },
  fr: { seller: "Vendeur", customer: "Client" },
  it: { seller: "Venditore", customer: "Cliente" },
  es: { seller: "Vendedor", customer: "Cliente" },
};
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  nl: "Dutch (Nederlands)",
  de: "German (Deutsch)",
  fr: "French (Français)",
  it: "Italian (Italiano)",
  es: "Spanish (Español)",
};

const FEEDBACK_LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Write ALL feedback text (comments, strengths, improvements, examples, summary) in English",
  nl: "Schrijf ALLE feedback tekst (comments, strengths, improvements, examples, summary) in het Nederlands",
  de: "Schreibe ALLE Feedback-Texte (comments, strengths, improvements, examples, summary) auf Deutsch",
  fr: "Écrivez TOUT le texte de feedback (comments, strengths, improvements, examples, summary) en français",
  it: "Scrivi TUTTO il testo di feedback (comments, strengths, improvements, examples, summary) in italiano",
  es: "Escribe TODO el texto de feedback (comments, strengths, improvements, examples, summary) en español",
};

const PHASE_RANGES: Record<FeedbackPhaseId, { start: number; end: number }> = {
  opening: { start: 1, end: 20 },
  needs_analysis: { start: 21, end: 39 },
  offer: { start: 40, end: 57 },
  agreement: { start: 58, end: 75 },
};
const PHASE_PROMPT_LABELS: Record<FeedbackPhaseId, string> = {
  opening: "Opening",
  needs_analysis: "Needs Analysis",
  offer: "Offer",
  agreement: "Agreement",
};
const clampScore = (value: number, min = 0, max = 10) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};
const ensureArray = (value: unknown) => (Array.isArray(value) ? value : []);

function mapPhases(phases: any[]): SalesCoachFeedbackPhase[] {
  return FEEDBACK_PHASES.map((id) => {
    const match = phases.find((phase) => phase?.id === id);
    return {
      id,
      score: clampScore(Number(match?.score ?? 0)),
      detected: Boolean(match?.detected),
      comments: String(match?.comments || ""),
    };
  });
}

function normalizeFeedback(payload: any): SalesCoachFeedback {
  const overallScore = clampScore(Number(payload?.overallScore ?? 0));
  const summary = String(payload?.summary || "");
  const phases = mapPhases(ensureArray(payload?.phases));

  let objections: SalesCoachFeedback["objections"] | undefined;
  
  if (payload?.objections) {
    objections = {
      detected: Boolean(payload.objections.detected),
      handled: ensureArray(payload.objections.handled)
        .map((item: any) => String(item))
        .slice(0, 6),
      mishandled: ensureArray(payload.objections.mishandled)
        .map((item: any) => String(item))
        .slice(0, 6),
      comments: payload.objections.comments
        ? String(payload.objections.comments)
        : undefined,
    };
  }

  return {
    overallScore,
    summary,
    phases,
    objections,
    strengths: ensureArray(payload?.strengths)
      .map((item: any) => String(item))
      .slice(0, 6),
    improvements: ensureArray(payload?.improvements)
      .map((item: any) => String(item))
      .slice(0, 6),
    examples: ensureArray(payload?.examples)
      .map((item: any) => String(item))
      .slice(0, 6),
  };
}

function formatTranscript(
  lang: string,
  history: ReturnType<typeof getHistory>
) {
  const roles = ROLE_NAMES[lang] || ROLE_NAMES.en;
  return history
    .slice(-40)
    .map(
      (msg) =>
        `${msg.role === "user" ? roles.seller : roles.customer}: ${msg.content}`
    )
    .join("\n");
}

function formatBulletList(values: string[], limit = 40) {
  const slice = values.slice(0, limit);
  return slice.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function extractJsonPayload(raw: string) {
  if (!raw) return raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  return raw.trim();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const phaseKey = String(session.phase || "").toLowerCase() as FeedbackPhaseId;

  if (!FEEDBACK_ELIGIBLE_PHASES.has(phaseKey)) {
    return NextResponse.json(
      { error: "Feedback is not available for this phase" },
      { status: 400 }
    );
  }

  const history = getHistory(sessionId);

  if (!history.length) {
    return NextResponse.json({ error: "Nothing to analyze" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const languageCode = normalizeLang(session.language || "en");
  const languageLabel = LANGUAGE_NAMES[languageCode] || "English";

  await loadKnowledge(false);

  const knowledge = await getKnowledgeFor(languageCode, phaseKey);
  const transcript = formatTranscript(languageCode, history);
  const knowledgeList = formatBulletList(knowledge.points || []);
  const objectionsList = formatBulletList(knowledge.objections || [], 20);
  const phaseRange = PHASE_RANGES[phaseKey];
  const langInstruction = FEEDBACK_LANGUAGE_INSTRUCTIONS[languageCode] || FEEDBACK_LANGUAGE_INSTRUCTIONS.en;

  const systemPrompt = `You are an expert sales coach analyzing a sales conversation according to a specific scoring system.

⚠️ CRITICAL LANGUAGE RULE: ${langInstruction}. Every single word of your feedback output MUST be in ${languageLabel}. Do NOT mix languages. The instructions below are in English for technical reasons only — your OUTPUT must be in ${languageLabel}.

THE SALESPERSON CHOSE TO PRACTICE THIS PHASE: ${PHASE_PROMPT_LABELS[phaseKey]}

TWO-PART ANALYSIS:
1. PHASE-SPECIFIC LEARNING POINTS: Analyze ONLY learning points ${phaseRange.start}-${phaseRange.end}
2. OBJECTIONS/RESISTANCES: ALWAYS analyze all objections (regardless of phase, as objections can occur in any phase)

DIVISION OF THE 75 LEARNING POINTS:
1. Opening/Introduction → Learning points 1-20
2. Needs Analysis → Learning points 21-39
3. Presentation/Offer → Learning points 40-57
4. Closing/Agreement → Learning points 58-75

FOR THIS SESSION: Analyze ONLY learning points ${phaseRange.start}-${phaseRange.end} (${PHASE_PROMPT_LABELS[phaseKey]})

SCORING SYSTEM (FOR BOTH LEARNING POINTS AND OBJECTIONS):
Each item receives one of these scores:
- 0 points = Completely incorrectly executed or not applied
- 1 point = Partially good, partially wrong (good start but missing essential elements)
- 3 points = Completely correctly executed

ANALYSIS TASK:
PART 1 - PHASE-SPECIFIC LEARNING POINTS:
1. Review ONLY learning points ${phaseRange.start} through ${phaseRange.end} (${PHASE_PROMPT_LABELS[phaseKey]})
2. Determine for each relevant learning point whether it was applied in this conversation
3. Score each applied learning point with 0, 1, or 3 points
4. Calculate overall score: (sum of all scores / maximum possible score) * 10

PART 2 - OBJECTIONS (CROSS-PHASE):
1. Review ALL objections from the knowledge document
2. Determine whether objections occurred in the conversation
3. Score how the salesperson handled each objection (0, 1, or 3 points)
4. Provide specific feedback on the handling of objections

RETURN YOUR ANALYSIS IN THE FOLLOWING JSON FORMAT (use NO markdown code blocks, only pure JSON):
{
  "overallScore": <calculated score 0-10 for this phase>,
  "phases": [
    {
      "id": "${phaseKey}",
      "score": <same as overallScore>,
      "detected": true,
      "comments": "<detailed feedback in ${languageLabel}. Mention ALL relevant learning points ${phaseRange.start}-${phaseRange.end} and their score.>"
    }
  ],
  "objections": {
    "detected": <true/false - were there objections in the conversation?>,
    "handled": ["<objection handled well (3 pts) with concrete example — in ${languageLabel}>"],
    "mishandled": ["<objection handled poorly (0 or 1 pt) with explanation — in ${languageLabel}>"],
    "comments": "<general feedback on objection handling — in ${languageLabel}>"
  },
  "strengths": ["<strong point in ${languageLabel}>"],
  "improvements": ["<improvement point in ${languageLabel}>"],
  "examples": ["<concrete quote from conversation in ${languageLabel}>"],
  "summary": "<full summary in ${languageLabel}>"
}

CRITICAL RULES:
- Analyze ONLY learning points ${phaseRange.start}-${phaseRange.end} for the phase
- ALWAYS analyze all objections (cross-phase)
- DO NOT mention learning points outside the range ${phaseRange.start}-${phaseRange.end}
- Use ONLY scores 0, 1, or 3 (not 2, not 1.5)
- In comments, mention the score for EVERY learning point/objection in parentheses
- If no objections occurred, set "detected": false and give a brief note
- Return ONLY pure JSON, no markdown code blocks
- ABSOLUTE LANGUAGE REQUIREMENT: Write ALL text values in ${languageLabel}. Not a single word in any other language.`;

  const userPrompt = `CONVERSATION TRANSCRIPT:
${transcript}

KNOWLEDGE DOCUMENT WITH LEARNING POINTS:
${knowledgeList || "No learning points provided."}

OBJECTIONS/RESISTANCES (ALWAYS ANALYZE, REGARDLESS OF PHASE):
${objectionsList || "No objections provided."}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: session.model || "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Empty response from model" },
        { status: 502 }
      );
    }

    let parsed: SalesCoachFeedback;
    const jsonPayload = extractJsonPayload(content);
    try {
      parsed = normalizeFeedback(JSON.parse(jsonPayload));
    } catch (error) {
      console.error("[feedback] Failed to parse AI response", error, content);
      return NextResponse.json(
        { error: "Failed to parse feedback" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[feedback] OpenAI request failed", error);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
