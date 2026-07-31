import type { ReportSection } from "@/components/PdfDownloadButton";

const STRATEGIC_GROUP_LABELS: Record<string, Record<string, string>> = {
  nl: {
    relational: "Relationeel",
    functional: "Functioneel",
    financial: "Financieel",
    organizational: "Organisatorisch",
    strategic: "Strategisch",
    urgency: "Urgentie",
  },
  en: {
    relational: "Relational",
    functional: "Functional",
    financial: "Financial",
    organizational: "Organizational",
    strategic: "Strategic",
    urgency: "Urgency",
  },
  de: {
    relational: "Relational",
    functional: "Funktional",
    financial: "Finanziell",
    organizational: "Organisatorisch",
    strategic: "Strategisch",
    urgency: "Dringlichkeit",
  },
  fr: {
    relational: "Relationnel",
    functional: "Fonctionnel",
    financial: "Financier",
    organizational: "Organisationnel",
    strategic: "Stratégique",
    urgency: "Urgence",
  },
  es: {
    relational: "Relacional",
    functional: "Funcional",
    financial: "Financiero",
    organizational: "Organizacional",
    strategic: "Estratégico",
    urgency: "Urgencia",
  },
  it: {
    relational: "Relazionale",
    functional: "Funzionale",
    financial: "Finanziario",
    organizational: "Organizzativo",
    strategic: "Strategico",
    urgency: "Urgenza",
  },
};

const STRATEGIC_SECTION_LABELS: Record<string, Record<string, string>> = {
  nl: {
    propositionExecution: "Propositie — Uitvoering",
    propositionResonance: "Propositie — Resonantie",
    competitorAdvantages: "Concurrentievoordelen",
    ownAdvantages: "Eigen voordelen",
    positiveComments: "Positieve reacties",
    negativeComments: "Verbeterpunten",
    trendsTitle: "Klantbehoeften & Trends",
    propositionTitle: "Propositie",
    competitionTitle: "Concurrentie",
    satisfactionTitle: "Klanttevredenheid",
  },
  en: {
    propositionExecution: "Proposition — Execution",
    propositionResonance: "Proposition — Resonance",
    competitorAdvantages: "Competitor advantages",
    ownAdvantages: "Own company advantages",
    positiveComments: "Positive comments",
    negativeComments: "Areas for improvement",
    trendsTitle: "Customer Needs & Trends",
    propositionTitle: "Proposition",
    competitionTitle: "Competition",
    satisfactionTitle: "Customer Satisfaction",
  },
  de: {
    propositionExecution: "Proposition — Ausführung",
    propositionResonance: "Proposition — Resonanz",
    competitorAdvantages: "Wettbewerbsvorteile",
    ownAdvantages: "Eigene Vorteile",
    positiveComments: "Positive Rückmeldungen",
    negativeComments: "Verbesserungspunkte",
    trendsTitle: "Kundenbedürfnisse & Trends",
    propositionTitle: "Proposition",
    competitionTitle: "Wettbewerb",
    satisfactionTitle: "Kundenzufriedenheit",
  },
  fr: {
    propositionExecution: "Proposition — Exécution",
    propositionResonance: "Proposition — Résonance",
    competitorAdvantages: "Avantages concurrentiels",
    ownAdvantages: "Avantages propres",
    positiveComments: "Commentaires positifs",
    negativeComments: "Points d'amélioration",
    trendsTitle: "Besoins clients & Tendances",
    propositionTitle: "Proposition",
    competitionTitle: "Concurrence",
    satisfactionTitle: "Satisfaction client",
  },
  es: {
    propositionExecution: "Propuesta — Ejecución",
    propositionResonance: "Propuesta — Resonancia",
    competitorAdvantages: "Ventajas competidoras",
    ownAdvantages: "Ventajas propias",
    positiveComments: "Comentarios positivos",
    negativeComments: "Áreas de mejora",
    trendsTitle: "Necesidades del cliente & Tendencias",
    propositionTitle: "Propuesta",
    competitionTitle: "Competencia",
    satisfactionTitle: "Satisfacción del cliente",
  },
  it: {
    propositionExecution: "Proposta — Esecuzione",
    propositionResonance: "Proposta — Risonanza",
    competitorAdvantages: "Vantaggi competitivi",
    ownAdvantages: "Vantaggi propri",
    positiveComments: "Commenti positivi",
    negativeComments: "Aree di miglioramento",
    trendsTitle: "Esigenze clienti & Tendenze",
    propositionTitle: "Proposta",
    competitionTitle: "Concorrenza",
    satisfactionTitle: "Soddisfazione del cliente",
  },
};

const OPERATIONAL_SECTION_LABELS: Record<string, Record<string, string>> = {
  nl: {
    phase1: "PICA — Fase 1: Propositie",
    phase2: "PICA — Fase 2: Inventarisatie",
    phase3: "PICA — Fase 3: Overtuiging",
    phase4: "PICA — Fase 4: Afsluiting",
    resistances: "Weerstanden",
    triggers: "Commerciële triggers",
    nextStepAbsolute: "Volgende stap discipline — Aantallen",
    nextStepPercentage: "Volgende stap discipline — Percentages",
    dmuTitle: "DMU Inzichten",
    dmuClarity: "DMU-helderheid",
    dmuMentionedLabel: "DMU besproken",
    dmuYes: "Ja",
    dmuNo: "Nee",
    decisionClear: "Beslissingsproces duidelijk",
    decisionUnclear: "Beslissingsproces onduidelijk",
  },
  en: {
    phase1: "PICA — Phase 1: Proposition",
    phase2: "PICA — Phase 2: Investigation",
    phase3: "PICA — Phase 3: Convincing",
    phase4: "PICA — Phase 4: Agreement",
    resistances: "Resistances",
    triggers: "Commercial triggers",
    nextStepAbsolute: "Next step discipline — Numbers",
    nextStepPercentage: "Next step discipline — Percentages",
    dmuTitle: "DMU Insights",
    dmuClarity: "DMU clarity score",
    dmuMentionedLabel: "DMU discussed",
    dmuYes: "Yes",
    dmuNo: "No",
    decisionClear: "Decision process clear",
    decisionUnclear: "Decision process unclear",
  },
  de: {
    phase1: "PICA — Phase 1: Proposition",
    phase2: "PICA — Phase 2: Analyse",
    phase3: "PICA — Phase 3: Überzeugung",
    phase4: "PICA — Phase 4: Abschluss",
    resistances: "Widerstände",
    triggers: "Kommerzielle Auslöser",
    nextStepAbsolute: "Nächster-Schritt-Disziplin — Zahlen",
    nextStepPercentage: "Nächster-Schritt-Disziplin — Prozentsätze",
    dmuTitle: "DMU Einblicke",
    dmuClarity: "DMU-Klarheit",
    dmuMentionedLabel: "DMU besprochen",
    dmuYes: "Ja",
    dmuNo: "Nein",
    decisionClear: "Entscheidungsprozess klar",
    decisionUnclear: "Entscheidungsprozess unklar",
  },
  fr: {
    phase1: "PICA — Phase 1 : Proposition",
    phase2: "PICA — Phase 2 : Investigation",
    phase3: "PICA — Phase 3 : Persuasion",
    phase4: "PICA — Phase 4 : Accord",
    resistances: "Résistances",
    triggers: "Déclencheurs commerciaux",
    nextStepAbsolute: "Discipline prochaine étape — Nombres",
    nextStepPercentage: "Discipline prochaine étape — Pourcentages",
    dmuTitle: "Aperçus DMU",
    dmuClarity: "Score de clarté DMU",
    dmuMentionedLabel: "DMU discuté",
    dmuYes: "Oui",
    dmuNo: "Non",
    decisionClear: "Processus décisionnel clair",
    decisionUnclear: "Processus décisionnel peu clair",
  },
  es: {
    phase1: "PICA — Fase 1: Propuesta",
    phase2: "PICA — Fase 2: Investigación",
    phase3: "PICA — Fase 3: Persuasión",
    phase4: "PICA — Fase 4: Acuerdo",
    resistances: "Resistencias",
    triggers: "Disparadores comerciales",
    nextStepAbsolute: "Disciplina siguiente paso — Números",
    nextStepPercentage: "Disciplina siguiente paso — Porcentajes",
    dmuTitle: "Perspectivas DMU",
    dmuClarity: "Puntuación claridad DMU",
    dmuMentionedLabel: "DMU discutido",
    dmuYes: "Sí",
    dmuNo: "No",
    decisionClear: "Proceso de decisión claro",
    decisionUnclear: "Proceso de decisión poco claro",
  },
  it: {
    phase1: "PICA — Fase 1: Proposta",
    phase2: "PICA — Fase 2: Analisi",
    phase3: "PICA — Fase 3: Persuasione",
    phase4: "PICA — Fase 4: Accordo",
    resistances: "Resistenze",
    triggers: "Trigger commerciali",
    nextStepAbsolute: "Disciplina prossimo passo — Numeri",
    nextStepPercentage: "Disciplina prossimo passo — Percentuali",
    dmuTitle: "Approfondimenti DMU",
    dmuClarity: "Punteggio chiarezza DMU",
    dmuMentionedLabel: "DMU discusso",
    dmuYes: "Sì",
    dmuNo: "No",
    decisionClear: "Processo decisionale chiaro",
    decisionUnclear: "Processo decisionale poco chiaro",
  },
};

const PICA_METRIC_LABELS: Record<string, Record<string, string>> = {
  nl: {
    breakTheIce: "IJsbreken", salesPitch: "Pitch", goalQuestion: "Doelvraag",
    expectationMgt: "Verwachtingen managen", contactPerson: "Gesprekspartner",
    company: "Bedrijf", cooperation: "Samenwerking", consequences: "Gevolgen",
    cure: "Oplossing", deepQuestioning: "Doorvragen", customerType: "Klantprofiel",
    uspUbrLink: "USP-koppeling", result: "Resultaat", acknowledgement: "Bevestiging",
    agreement: "Concrete afspraak",
  },
  en: {
    breakTheIce: "Ice breaker", salesPitch: "Pitch", goalQuestion: "Goal question",
    expectationMgt: "Expectation management", contactPerson: "Contact person",
    company: "Company", cooperation: "Cooperation", consequences: "Consequences",
    cure: "Solution", deepQuestioning: "Deep questioning", customerType: "Customer profile",
    uspUbrLink: "USP link", result: "Result", acknowledgement: "Confirmation",
    agreement: "Concrete agreement",
  },
  de: {
    breakTheIce: "Einstieg", salesPitch: "Pitch", goalQuestion: "Zielfrage",
    expectationMgt: "Erwartungsmanagement", contactPerson: "Kontaktperson",
    company: "Unternehmen", cooperation: "Zusammenarbeit", consequences: "Konsequenzen",
    cure: "Lösung", deepQuestioning: "Tiefes Fragen", customerType: "Kundenprofil",
    uspUbrLink: "USP-Verknüpfung", result: "Ergebnis", acknowledgement: "Bestätigung",
    agreement: "Konkrete Vereinbarung",
  },
  fr: {
    breakTheIce: "Brise-glace", salesPitch: "Pitch", goalQuestion: "Question d'objectif",
    expectationMgt: "Gestion des attentes", contactPerson: "Interlocuteur",
    company: "Entreprise", cooperation: "Coopération", consequences: "Conséquences",
    cure: "Solution", deepQuestioning: "Questionnement approfondi", customerType: "Profil client",
    uspUbrLink: "Lien USP", result: "Résultat", acknowledgement: "Confirmation",
    agreement: "Accord concret",
  },
  es: {
    breakTheIce: "Rompe el hielo", salesPitch: "Pitch", goalQuestion: "Pregunta de objetivo",
    expectationMgt: "Gestión de expectativas", contactPerson: "Persona de contacto",
    company: "Empresa", cooperation: "Cooperación", consequences: "Consecuencias",
    cure: "Solución", deepQuestioning: "Pregunta profunda", customerType: "Perfil del cliente",
    uspUbrLink: "Vinculación USP", result: "Resultado", acknowledgement: "Confirmación",
    agreement: "Acuerdo concreto",
  },
  it: {
    breakTheIce: "Rompere il ghiaccio", salesPitch: "Pitch", goalQuestion: "Domanda obiettivo",
    expectationMgt: "Gestione aspettative", contactPerson: "Persona di contatto",
    company: "Azienda", cooperation: "Cooperazione", consequences: "Conseguenze",
    cure: "Soluzione", deepQuestioning: "Domande approfondite", customerType: "Profilo cliente",
    uspUbrLink: "Collegamento USP", result: "Risultato", acknowledgement: "Conferma",
    agreement: "Accordo concreto",
  },
};

const PHASE_METRIC_KEYS = [
  ["breakTheIce", "salesPitch", "goalQuestion", "expectationMgt"],
  ["contactPerson", "company", "cooperation", "consequences", "cure", "deepQuestioning", "customerType"],
  ["uspUbrLink", "result", "acknowledgement"],
  ["agreement"],
];

export function buildStrategicReportSections(analytics: any, language: string): ReportSection[] {
  const lang = language in STRATEGIC_GROUP_LABELS ? language : "en";
  const groupLabels = STRATEGIC_GROUP_LABELS[lang];
  const sectionLabels = STRATEGIC_SECTION_LABELS[lang];

  const trendGroups = analytics?.trends?.trendGroups || {};
  const GROUP_KEYS = ["relational", "functional", "financial", "organizational", "strategic", "urgency"];

  const trendSections: ReportSection[] = GROUP_KEYS.map(group => ({
    title: `${sectionLabels.trendsTitle} — ${groupLabels[group]}`,
    type: "table" as const,
    data: ((trendGroups[group] || []) as any[]).slice(0, 5).map((item: any) => ({
      name: item.name,
      value: item.value,
    })),
  }));

  const proposition = analytics?.proposition || {};
  const propositionSections: ReportSection[] = [
    {
      title: sectionLabels.propositionExecution,
      type: "table" as const,
      data: (proposition.execution || []).map((item: any) => ({ name: item.name, value: item.value })),
    },
    {
      title: sectionLabels.propositionResonance,
      type: "table" as const,
      data: (proposition.resonance || []).map((item: any) => ({ name: item.name, value: item.value })),
    },
  ];

  const competition = analytics?.competition || {};
  const competitionSections: ReportSection[] = [
    {
      title: sectionLabels.competitorAdvantages,
      type: "table" as const,
      data: ((competition.competitors || []) as any[]).map((item: any) => ({
        name: item.competitor ? `${item.competitor}: ${item.name}` : item.name,
        value: item.value,
      })),
    },
    {
      title: sectionLabels.ownAdvantages,
      type: "table" as const,
      data: (competition.strengths || []).map((item: any) => ({ name: item.name, value: item.value })),
    },
  ];

  const satisfaction = analytics?.customerSatisfaction || {};
  const satisfactionSections: ReportSection[] = [
    {
      title: sectionLabels.positiveComments,
      type: "table" as const,
      data: ((satisfaction.sentiments || []) as any[]).slice(0, 10).map((item: any) => ({
        name: item.name,
        value: item.value,
      })),
    },
    {
      title: sectionLabels.negativeComments,
      type: "table" as const,
      data: ((satisfaction.issues || []) as any[]).slice(0, 10).map((item: any) => ({
        name: item.name,
        value: item.value,
      })),
    },
  ];

  return [...trendSections, ...propositionSections, ...competitionSections, ...satisfactionSections];
}

export function buildOperationalReportSections(analytics: any, language: string): ReportSection[] {
  const lang = language in OPERATIONAL_SECTION_LABELS ? language : "en";
  const labels = OPERATIONAL_SECTION_LABELS[lang];
  const metricLabels = PICA_METRIC_LABELS[lang] || PICA_METRIC_LABELS.en;

  const phaseDetails: any[] = analytics?.picaPerformance?.phaseDetails || [];
  const phaseKeys = [labels.phase1, labels.phase2, labels.phase3, labels.phase4];

  const getPhaseMetrics = (phaseNum: number): { key: string; value: number }[] => {
    const detail = phaseDetails.find((d: any) => d.phase === phaseNum);
    if (detail) return detail.metrics || [];
    return PHASE_METRIC_KEYS[phaseNum - 1].map(key => ({ key, value: 0 }));
  };

  const picaSections: ReportSection[] = phaseKeys.map((name, i) => ({
    title: name,
    type: "table" as const,
    data: getPhaseMetrics(i + 1).map(m => ({
      name: metricLabels[m.key] || m.key,
      value: m.value,
    })),
  }));

  const resistanceSections: ReportSection[] = [
    {
      title: labels.resistances,
      type: "table" as const,
      data: (analytics?.resistanceNeeds?.resistances || []).map((item: any) => ({
        name: item.name,
        value: item.value,
      })),
    },
    {
      title: labels.triggers,
      type: "table" as const,
      data: (analytics?.resistanceNeeds?.triggers || []).map((item: any) => ({
        name: item.name,
        value: item.value,
      })),
    },
  ];

  const nextStepSections: ReportSection[] = [
    {
      title: labels.nextStepAbsolute,
      type: "table" as const,
      data: (analytics?.nextStepDiscipline?.absolute || []).map((item: any) => ({
        name: item.name,
        value: item.value,
      })),
    },
    {
      title: labels.nextStepPercentage,
      type: "table" as const,
      data: (analytics?.nextStepDiscipline?.percentages || []).map((item: any) => ({
        name: item.name,
        value: item.value,
      })),
    },
  ];

  const dmu = analytics?.dmuInsights;
  const dmuSection: ReportSection[] = dmu
    ? [
        {
          title: labels.dmuTitle,
          type: "table" as const,
          data: [
            { name: labels.dmuClarity, value: `${dmu.dmuClarity ?? 0}/100` },
            { name: labels.dmuMentionedLabel, value: dmu.dmuMentioned ? labels.dmuYes : labels.dmuNo },
            { name: labels.decisionClear, value: dmu.decisionProcessClear ? labels.decisionClear : labels.decisionUnclear },
            ...(dmu.stakeholders || []).map((s: any) => ({
              name: s.name,
              value: `${s.role} — ${s.mentioned ? labels.dmuYes : labels.dmuNo}`,
            })),
          ],
        },
      ]
    : [];

  return [...picaSections, ...resistanceSections, ...nextStepSections, ...dmuSection];
}

export function buildStrategicReportTitle(language: string): string {
  const titles: Record<string, string> = {
    nl: "Strategisch Analyserapport",
    en: "Strategic Analysis Report",
    de: "Strategischer Analysebericht",
    fr: "Rapport d'analyse stratégique",
    es: "Informe de análisis estratégico",
    it: "Rapporto di analisi strategica",
  };
  return titles[language] || titles.en;
}

export function buildOperationalReportTitle(language: string): string {
  const titles: Record<string, string> = {
    nl: "Operationeel Analyserapport",
    en: "Operational Analysis Report",
    de: "Operativer Analysebericht",
    fr: "Rapport d'analyse opérationnel",
    es: "Informe de análisis operacional",
    it: "Rapporto di analisi operativa",
  };
  return titles[language] || titles.en;
}
