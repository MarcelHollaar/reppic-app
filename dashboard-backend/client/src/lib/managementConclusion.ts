/**
 * managementConclusion.ts — backward-compatibele re-export
 *
 * Canonieke bron verplaatst naar lib/dashboard/generateManagementSummary.ts.
 * Alle bestaande imports blijven werken zonder aanpassing.
 */
export {
  enrichedToMgmtItems,
  useManagementConclusion,
  CONCLUSION_SECTION_META,
} from "./dashboard/generateManagementSummary";

export type {
  ConclusionThemeType,
  ManagementConclusionItem,
  ManagementConclusionInput,
  ManagementConclusionOutput,
  UseManagementConclusionReturn,
} from "./dashboard/generateManagementSummary";
