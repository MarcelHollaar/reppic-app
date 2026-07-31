export type FeedbackPhaseId = "opening" | "needs_analysis" | "offer" | "agreement";

export type SalesCoachFeedbackPhase = {
  id: FeedbackPhaseId;
  score: number;
  detected: boolean;
  comments: string;
};

export type SalesCoachObjectionFeedback = {
  detected: boolean;
  handled: string[];
  mishandled: string[];
  comments?: string;
};

export type SalesCoachFeedback = {
  overallScore: number;
  summary: string;
  phases: SalesCoachFeedbackPhase[];
  objections?: SalesCoachObjectionFeedback;
  strengths: string[];
  improvements: string[];
  examples: string[];
};
