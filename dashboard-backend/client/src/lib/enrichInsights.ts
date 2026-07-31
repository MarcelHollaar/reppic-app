/**
 * enrichInsights.ts — backward-compatibele re-export
 *
 * Canonieke bron verplaatst naar lib/dashboard/enrichInsightItems.ts.
 * Alle bestaande imports blijven werken zonder aanpassing.
 */
export {
  enrichInsightItems,
  enrichInsights,
  sortByUrgency,
} from "./dashboard/enrichInsightItems";

export type {
  RawInsightInput,
  EnrichedInsightItem,
} from "./dashboard/enrichInsightItems";
