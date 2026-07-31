/**
 * priorityScore.ts — backward-compatibele re-export
 *
 * Canonieke bron verplaatst naar lib/dashboard/calculatePriority.ts.
 * Alle bestaande imports blijven werken zonder aanpassing.
 */
export {
  computePriority,
  getTrendLabel,
} from "./dashboard/calculatePriority";

export type {
  PriorityLabel,
  ScoreLevel,
  PriorityResult,
  ComputePriorityInput,
} from "./dashboard/calculatePriority";
