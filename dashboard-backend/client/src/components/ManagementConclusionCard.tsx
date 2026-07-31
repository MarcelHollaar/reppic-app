/**
 * ManagementConclusionCard
 *
 * Achterwaarts compatibele wrapper die re-exporteert vanuit
 * components/dashboard/InsightConclusionCard — de canonieke implementatie.
 *
 * Bestaande imports blijven werken:
 *   import { ManagementConclusionCard } from "@/components/ManagementConclusionCard";
 */

import {
  InsightConclusionCard,
  type InsightConclusionCardProps,
} from "./dashboard/InsightConclusionCard";

export type ManagementConclusionCardProps = InsightConclusionCardProps;

export function ManagementConclusionCard(props: ManagementConclusionCardProps) {
  return <InsightConclusionCard {...props} />;
}
