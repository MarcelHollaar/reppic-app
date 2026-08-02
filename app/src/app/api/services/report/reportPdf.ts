/**
 * Server-side PDF-bouwer voor het maandelijkse manager-rapport (Node, jsPDF).
 *
 * Afgeleid van de browser-versie in dashboard-backend (reportBuilder.ts), maar
 * server-geschikt gemaakt: het logo wordt van schijf gelezen i.p.v. via een
 * browser-fetch, en de functie geeft PDF-bytes (Buffer) terug i.p.v. een
 * download te triggeren. Eén gecombineerde PDF met alle dashboard-blokken.
 */

import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
import type { DashboardReport, ReportSection } from "./reportSections";

// jspdf-autotable exporteert als default; robuust ophalen.
const autoTable = (autoTableImport as unknown as { default?: typeof autoTableImport })
  .default ?? (autoTableImport as unknown as typeof autoTableImport);

export type PdfStructuralLabels = {
  reportTitle: string;
  generatedOn: string;
  period: string;
  confidential: string;
  category: string;
  value: string;
  percentage: string;
  total: string;
  metric: string;
  noData: string;
  page: string;
  of: string;
  /** Kolomkop voor de maand-op-maand delta, bijv. "t.o.v. vorige maand". */
  vsLastMonth: string;
};

export type BuildPdfParams = {
  companyTitle: string;
  periodLabel: string;
  lang: string;
  generatedOnText: string;
  blocks: DashboardReport[];
  labels: PdfStructuralLabels;
};

const PRIMARY: [number, number, number] = [88, 112, 246]; // #5870f6 (Reppic-blauw)
const SECONDARY: [number, number, number] = [52, 73, 94];
const LIGHT: [number, number, number] = [236, 240, 241];
const TEXT: [number, number, number] = [44, 62, 80];

let cachedLogo: string | null | undefined;
function logoDataUrl(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const p = path.join(process.cwd(), "public", "img", "reppic_logo_email.png");
    cachedLogo = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

export function buildMonthlyReportPdf(params: BuildPdfParams): Buffer {
  const { companyTitle, periodLabel, generatedOnText, blocks, labels: t } = params;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const logo = logoDataUrl();
  let currentY = margin;

  const pageBreak = (need: number) => currentY + need > pageHeight - 25;

  function header(title: string) {
    pdf.setFillColor(...PRIMARY);
    pdf.rect(0, 0, pageWidth, 15, "F");
    if (logo) {
      try {
        pdf.addImage(logo, "PNG", 5, 2.5, 10, 10);
      } catch {
        /* logo optioneel */
      }
    }
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(t.reportTitle, logo ? 18 : margin, 9.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(title, pageWidth - margin, 9.5, { align: "right" });
    currentY = 25;
  }

  function newPage(title: string) {
    pdf.addPage();
    header(title);
  }

  function sectionTitle(title: string) {
    if (pageBreak(20)) newPage(companyTitle);
    pdf.setFillColor(...SECONDARY);
    pdf.rect(margin, currentY, 4, 8, "F");
    pdf.setTextColor(...SECONDARY);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin + 8, currentY + 6);
    currentY += 14;
  }

  function metricsSection(s: Extract<ReportSection, { type: "metrics" }>) {
    sectionTitle(s.title);
    if (!s.data.length) return emptyLine();
    // Maand-op-maand kolom alleen tonen als minstens één tegel een delta heeft
    // (eerste rapportperiode heeft er geen).
    const withDelta = s.data.some((m) => m.delta !== undefined);
    autoTable(pdf, {
      startY: currentY,
      head: [withDelta ? [t.metric, t.value, t.vsLastMonth] : [t.metric, t.value]],
      body: s.data.map((m) =>
        withDelta
          ? [m.label, String(m.value), m.delta ?? ""]
          : [m.label, String(m.value)],
      ),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3.5, textColor: TEXT },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: withDelta
        ? {
            1: { halign: "right", cellWidth: contentWidth * 0.25 },
            2: { halign: "right", cellWidth: contentWidth * 0.25 },
          }
        : { 1: { halign: "right", cellWidth: contentWidth * 0.35 } },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 12;
  }

  function tableSection(s: Extract<ReportSection, { type: "table" }>) {
    sectionTitle(s.title);
    if (!s.data.length) return emptyLine();
    const total = s.data.reduce((sum, i) => sum + i.value, 0);
    const body = s.data.map((i) => {
      const pct =
        i.percentage !== undefined
          ? `${i.percentage.toFixed(1)}%`
          : total > 0
            ? `${((i.value / total) * 100).toFixed(1)}%`
            : "0%";
      return [i.name, String(i.value), pct];
    });
    autoTable(pdf, {
      startY: currentY,
      head: [[t.category, t.value, t.percentage]],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3.5, textColor: TEXT },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 12;
  }

  function textSection(s: Extract<ReportSection, { type: "text" }>) {
    sectionTitle(s.title);
    if (!s.data) return emptyLine();
    pdf.setTextColor(...TEXT);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(s.data, contentWidth);
    if (pageBreak(lines.length * 5 + 8)) newPage(companyTitle);
    pdf.text(lines, margin, currentY);
    currentY += lines.length * 5 + 10;
  }

  function listSection(s: Extract<ReportSection, { type: "list" }>) {
    sectionTitle(s.title);
    if (!s.data.length) return emptyLine();
    pdf.setTextColor(...TEXT);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    for (const item of s.data) {
      const lines = pdf.splitTextToSize(item, contentWidth - 6);
      if (pageBreak(lines.length * 5 + 4)) newPage(companyTitle);
      pdf.setFillColor(...PRIMARY);
      pdf.circle(margin + 1.2, currentY - 1.3, 0.9, "F"); // bullet
      pdf.text(lines, margin + 6, currentY);
      currentY += lines.length * 5 + 3;
    }
    currentY += 7;
  }

  function emptyLine() {
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(10);
    pdf.text(t.noData, margin, currentY);
    currentY += 10;
  }

  // --- Cover ---
  pdf.setFillColor(...PRIMARY);
  pdf.rect(0, 0, pageWidth, 80, "F");
  pdf.setFillColor(...LIGHT);
  pdf.rect(0, 80, pageWidth, pageHeight - 80, "F");
  if (logo) {
    try {
      pdf.addImage(logo, "PNG", margin, 16, 28, 28);
    } catch {
      /* logo optioneel */
    }
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(26);
  pdf.setFont("helvetica", "bold");
  pdf.text(t.reportTitle, pageWidth / 2, 40, { align: "center" });
  pdf.setTextColor(...TEXT);
  pdf.setFontSize(22);
  pdf.text(companyTitle, pageWidth / 2, 120, { align: "center" });
  pdf.setFillColor(...PRIMARY);
  pdf.rect(margin, 135, contentWidth, 0.5, "F");
  pdf.setFontSize(12);
  pdf.setTextColor(...SECONDARY);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${t.period}: ${periodLabel}`, pageWidth / 2, 155, { align: "center" });
  pdf.text(`${t.generatedOn}: ${generatedOnText}`, pageWidth / 2, 165, { align: "center" });
  pdf.setFontSize(10);
  pdf.setTextColor(150, 150, 150);
  pdf.text(t.confidential, pageWidth / 2, pageHeight - 18, { align: "center" });

  // --- Blokken (operationeel, strategisch) ---
  for (const block of blocks) {
    newPage(block.heading);
    // Bloktitel prominent bovenaan de eerste pagina van het blok.
    pdf.setTextColor(...PRIMARY);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(block.heading, margin, currentY + 4);
    currentY += 14;
    for (const section of block.sections) {
      if (section.type === "metrics") metricsSection(section);
      else if (section.type === "table") tableSection(section);
      else if (section.type === "list") listSection(section);
      else textSection(section);
    }
  }

  // --- Footers ---
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFillColor(...LIGHT);
    pdf.rect(0, pageHeight - 12, pageWidth, 12, "F");
    pdf.setTextColor(...SECONDARY);
    pdf.setFontSize(9);
    pdf.text(`${t.page} ${i - 1} ${t.of} ${totalPages - 1}`, pageWidth / 2, pageHeight - 5, {
      align: "center",
    });
    pdf.text(t.confidential, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  return Buffer.from(pdf.output("arraybuffer"));
}
