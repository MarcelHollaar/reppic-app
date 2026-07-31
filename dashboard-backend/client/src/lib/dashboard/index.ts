/**
 * lib/dashboard — centrale logicalaag voor dashboard-verwerking
 *
 * Importeer via:
 *   import { calculateTrend, computePriority, buildAlertText, ... } from "@/lib/dashboard";
 */

export {
  calculateTrend,
  getTrendLabel,
} from "./calculateTrend";
export type { TrendDirection, TrendResult } from "./calculateTrend";

export {
  computePriority,
} from "./calculatePriority";
export type {
  PriorityLabel,
  ScoreLevel,
  PriorityResult,
  ComputePriorityInput,
} from "./calculatePriority";

export { buildAlertText } from "./buildAlertText";
export type { BuildAlertTextInput } from "./buildAlertText";

export {
  enrichInsightItems,
  enrichInsights,
  sortByUrgency,
} from "./enrichInsightItems";
export type {
  RawInsightInput,
  EnrichedInsightItem,
} from "./enrichInsightItems";

export {
  enrichedToMgmtItems,
  useManagementConclusion,
  CONCLUSION_SECTION_META,
} from "./generateManagementSummary";
export type {
  ConclusionThemeType,
  ManagementConclusionItem,
  ManagementConclusionInput,
  ManagementConclusionOutput,
  UseManagementConclusionReturn,
} from "./generateManagementSummary";
