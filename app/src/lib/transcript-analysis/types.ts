export type Resistance = {
  KlantWeerstand: string;
  VerkoperReactie: string;
  Conclusie: "Goed" | "Fout";
  Reden: string;
};

export type AnalysisPhase = {
  Fase: number;
  Titel: string;
  Score: number;
  Redenering: string;
  Doel?: string;
  AnalysePunten?: string;
  GoedVoorbeeld?: string;
  DeelsGoedVoorbeeld?: string;
  FoutVoorbeeld?: string;
  PuntenGoed?: number;
  PuntenDeelsGoed?: number;
  PuntenFout?: number;
  ToekenningPuntenGoed?: string;
  ToekenningPuntenDeelsGoed?: string;
  ToekenningPuntenFout?: string;
};

export type AnalysisOutput = {
  /** True when the transcript is not an analyzable sales conversation (monologue, voicemail, too short). */
  GeenSalesgesprek?: boolean;
  /** One-sentence evidence-based reasoning behind the Sfeer label. */
  SfeerToelichting?: string;
  Klanttype: string;
  Weerstanden: Resistance[];
  Fases: AnalysisPhase[];
  Totaalscore: number;
  Sfeer: string;
  /** Seller's share of spoken words (0-100), or null when not determinable. */
  PercentageVerkoper: number | null;
  Samenvatting: string;
  Mail: string;
  Leerpunten: string[];
};

/** Twin webhook legacy shape for Weerstanden */
export type TwinWeerstandenPayload =
  | { text: string }
  | Resistance[]
  | null
  | undefined;

export type AnalysisPersistOutput = AnalysisOutput & {
  Weerstanden?: TwinWeerstandenPayload;
};
