/**
 * DashboardFilterBar
 *
 * Standaard filterbalk die bovenaan elke dashboardpagina staat.
 * Bevat: paginatitel + beschrijving (links) · DashboardTypeSelector + TimeFilter + PDF-knop (rechts).
 *
 * Vervangt het herhalende header-blok in alle operationele en strategische dashboards.
 */

import { TimeFilter, type DateSelection } from "@/components/TimeFilter";
import { DashboardTypeSelector, type DashboardType } from "@/components/DashboardTypeSelector";
import { PdfDownloadButton, type ReportSection } from "@/components/PdfDownloadButton";
import type { Language } from "@/components/LanguageSelector";

export interface DashboardFilterBarProps {
  /** Paginatitel. */
  title: string;
  /** Optionele subtitel / beschrijving onder de titel. */
  description?: string;

  /** Huidig geselecteerde datum (jaar + maand). */
  selectedDate: DateSelection;
  onDateChange: (date: DateSelection) => void;

  /** Huidig dashboardtype; toon wisselknop indien opgegeven. */
  dashboardType?: DashboardType;
  onSwitchDashboard?: () => void;

  /** PDF-downloadknop: geef sections mee om de knop te tonen. */
  pdfSections?: ReportSection[];
  pdfTitle?: string;
  pdfSubtitle?: string;
  pdfPeriod?: string;
  pdfConclusion?: string;
  pdfButtonText?: string;
  language?: Language;

  /** Extra inhoud rechts van de filtercontroles. */
  right?: React.ReactNode;

  className?: string;
}

export function DashboardFilterBar({
  title,
  description,
  selectedDate,
  onDateChange,
  dashboardType,
  onSwitchDashboard,
  pdfSections,
  pdfTitle,
  pdfSubtitle,
  pdfPeriod,
  pdfConclusion,
  pdfButtonText,
  language = 'nl' as Language,
  right,
  className = "",
}: DashboardFilterBarProps) {
  const showPdf = pdfSections && pdfSections.length > 0;
  const showSwitch = dashboardType !== undefined && !!onSwitchDashboard;

  return (
    <div
      className={`flex items-start justify-between flex-wrap gap-4 ${className}`}
      data-testid="dashboard-filter-bar"
    >
      {/* Titel + beschrijving */}
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold mb-1 truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Filtercontroles */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0" data-testid="dashboard-controls">
        {showSwitch && (
          <DashboardTypeSelector
            currentType={dashboardType!}
            onSwitch={onSwitchDashboard!}
          />
        )}

        <TimeFilter
          selectedDate={selectedDate}
          onDateChange={onDateChange}
        />

        {showPdf && (
          <PdfDownloadButton
            dashboardTitle={pdfTitle ?? title}
            dashboardSubtitle={pdfSubtitle ?? description ?? ""}
            period={pdfPeriod ?? `${selectedDate.month}/${selectedDate.year}`}
            conclusion={pdfConclusion}
            sections={pdfSections!}
            language={language}
            dashboardType={dashboardType ?? "operational"}
            buttonText={pdfButtonText ?? "PDF"}
          />
        )}

        {right}
      </div>
    </div>
  );
}
