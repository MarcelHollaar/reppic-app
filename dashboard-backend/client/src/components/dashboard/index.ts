/**
 * components/dashboard — gedeelde dashboard-bouwblokken
 *
 * Importeer via:
 *   import { TrendIndicator, PriorityBadge, RankedBarList, ... } from "@/components/dashboard";
 */

export { TrendIndicator } from "./TrendIndicator";
export type { TrendIndicatorProps, TrendDirection } from "./TrendIndicator";

export { PriorityBadge } from "./PriorityBadge";
export type { PriorityBadgeProps, PriorityLabel } from "./PriorityBadge";

export { InsightAlert, InsightAlertBlock } from "./InsightAlert";
export type { InsightAlertProps, AlertVariant } from "./InsightAlert";

export { InsightActionList, parseRoleActions } from "./InsightActionList";
export type { InsightActionListProps, RoleAction } from "./InsightActionList";

export { RankedBarRow } from "./RankedBarRow";
export type { RankedBarRowProps } from "./RankedBarRow";

export { RankedBarList } from "./RankedBarList";
export type { RankedBarListProps, RankedBarListItem } from "./RankedBarList";

export { InsightSummaryBanner } from "./InsightSummaryBanner";
export type { InsightSummaryBannerProps, SummaryItem } from "./InsightSummaryBanner";

export { InsightConclusionCard } from "./InsightConclusionCard";
export type { InsightConclusionCardProps } from "./InsightConclusionCard";

export { DashboardFilterBar } from "./DashboardFilterBar";
export type { DashboardFilterBarProps } from "./DashboardFilterBar";
