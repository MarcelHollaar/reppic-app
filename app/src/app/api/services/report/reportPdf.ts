/**
 * Server-side PDF-bouwer voor het maandelijkse manager-rapport (Node, jsPDF).
 *
 * Professioneel, strak design: proportioneel logo, gekaderde onderwerpen (cards),
 * KPI-tegels en een rustige typografische hiërarchie. Logo van schijf, bytes terug.
 */

import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
import type { DashboardReport, ReportSection } from "./reportSections";

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

// ── Palet (Reppic-huisstijl) ──────────────────────────────────────────────
type RGB = [number, number, number];
const BLUE: RGB = [88, 112, 246]; // #5870f6
const BLUE_DK: RGB = [67, 83, 232];
const INK: RGB = [30, 41, 59]; // slate-800
const MUTED: RGB = [100, 116, 139]; // slate-500
const CARD_BG: RGB = [248, 250, 252]; // slate-50
const BORDER: RGB = [226, 232, 240]; // slate-200
const GREEN: RGB = [22, 163, 74];
const RED: RGB = [220, 38, 38];

const LOGO_RATIO = 248 / 79; // echte pixelverhouding van reppic_logo_email.png

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
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 18; // paginamarge
  const CW = PW - M * 2; // inhoudsbreedte
  const logo = logoDataUrl();
  let y = M;

  const setFill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
  const LH = 4.8; // regelhoogte bij 10pt

  // De standaard jsPDF-fonts (WinAnsi) kennen ▲ ▼ → − niet → saneren naar
  // veilige glyphs. Richting wordt in de tegels al via kleur getoond.
  const safe = (s: unknown) =>
    String(s ?? "")
      .replace(/[▲▼]\s*/g, "")
      .replace(/→/g, "»")
      .replace(/−/g, "-");

  function drawLogo(x: number, top: number, h: number) {
    if (!logo) return;
    try {
      pdf.addImage(logo, "PNG", x, top, h * LOGO_RATIO, h);
    } catch {
      /* logo optioneel */
    }
  }

  function need(space: number) {
    if (y + space > PH - 20) {
      pdf.addPage();
      pageHeader();
    }
  }

  // Slanke, elegante paginakop (op elke inhoudspagina).
  function pageHeader() {
    drawLogo(M, 12, 6);
    setText(MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(safe(companyTitle), PW - M, 15.5, { align: "right" });
    setDraw(BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(M, 20, PW - M, 20);
    y = 28;
  }

  // Hoofdstuk-titel (per blok): accentbalkje + grote titel.
  function chapter(title: string) {
    need(18);
    setFill(BLUE);
    pdf.roundedRect(M, y, 3.5, 9, 1, 1, "F");
    setText(INK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(safe(title), M + 8, y + 7);
    y += 15;
  }

  // Sectiekop binnen een blok.
  function sectionTitle(title: string) {
    need(12);
    setText(BLUE_DK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(safe(title).toUpperCase(), M, y + 4);
    y += 8;
  }

  function measure(text: string, width: number, size: number): string[] {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(safe(text), width);
  }

  // Gekaderde tekstkaart (voor de managementsamenvatting-onderdelen + conclusies).
  function paragraphCard(title: string, body: string) {
    const pad = 5;
    const innerW = CW - pad * 2;
    const bodyLines = measure(body, innerW, 10);
    const cardH = pad + 5.5 + bodyLines.length * LH + pad;
    need(cardH + 4);
    setFill(CARD_BG);
    setDraw(BORDER);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(M, y, CW, cardH, 2.5, 2.5, "FD");
    // accent links
    setFill(BLUE);
    pdf.rect(M, y + 2.5, 1.4, cardH - 5, "F");
    // label
    setText(BLUE_DK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.text(safe(title), M + pad, y + pad + 2);
    // body
    setText(INK);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(bodyLines, M + pad, y + pad + 7);
    y += cardH + 4;
  }

  // Gekaderde bullet-lijst (Kansen / Aandachtspunten).
  function listCard(title: string, items: string[], accent: RGB) {
    sectionTitle(title);
    const pad = 5;
    const innerW = CW - pad * 2 - 4;
    const wrapped = items.map((it) => measure(it, innerW, 10));
    const cardH = pad + wrapped.reduce((s, l) => s + l.length * LH + 2, 0) + pad - 2;
    need(cardH + 4);
    setFill([255, 255, 255]);
    setDraw(BORDER);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(M, y, CW, cardH, 2.5, 2.5, "FD");
    let ly = y + pad + 2;
    for (const lines of wrapped) {
      setFill(accent);
      pdf.circle(M + pad + 0.6, ly - 1.3, 1, "F");
      setText(INK);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(lines, M + pad + 4, ly);
      ly += lines.length * LH + 2;
    }
    y += cardH + 4;
  }

  const deltaColor = (d: string): RGB =>
    d.startsWith("▲") ? GREEN : d.startsWith("▼") ? RED : MUTED;

  // KPI-tegels (3 per rij, gekaderd).
  function kpiTiles(
    tiles: { label: string; value: string | number; delta?: string }[],
  ) {
    const perRow = 3;
    const gap = 4;
    const tileW = (CW - gap * (perRow - 1)) / perRow;
    const tileH = 24;
    for (let i = 0; i < tiles.length; i += perRow) {
      const row = tiles.slice(i, i + perRow);
      need(tileH + 4);
      row.forEach((tile, j) => {
        const x = M + j * (tileW + gap);
        setFill([255, 255, 255]);
        setDraw(BORDER);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, tileW, tileH, 2.5, 2.5, "FD");
        setText(BLUE);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(17);
        pdf.text(safe(tile.value), x + tileW / 2, y + 11, { align: "center" });
        if (tile.delta) {
          // Kleur uit het originele teken; tekst gesaneerd naar "+N"/"-N".
          setText(deltaColor(tile.delta));
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.text(safe(tile.delta), x + tileW / 2, y + 16, { align: "center" });
        }
        setText(MUTED);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.8);
        const lbl = pdf.splitTextToSize(safe(tile.label), tileW - 4);
        pdf.text(lbl.slice(0, 2), x + tileW / 2, y + 20, { align: "center" });
      });
      y += tileH + gap;
    }
    y += 2;
  }

  function dataTable(title: string, rows: string[][], head: string[]) {
    sectionTitle(title);
    need(16);
    autoTable(pdf, {
      startY: y,
      head: [head.map(safe)],
      body: rows.map((r) => r.map(safe)),
      margin: { left: M, right: M },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: INK,
        lineColor: BORDER,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: BLUE,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left",
      },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      columnStyles: {
        1: { halign: "right", cellWidth: 24 },
        2: { halign: "right", cellWidth: 26 },
      },
    });
    y = ((pdf as any).lastAutoTable?.finalY ?? y) + 8;
  }

  function noData() {
    setText(MUTED);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.text(t.noData, M, y + 3);
    y += 8;
  }

  // ── COVER ─────────────────────────────────────────────────────────────
  drawLogo(M, 22, 12);
  setDraw(BORDER);
  pdf.setLineWidth(0.4);
  pdf.line(M, 42, PW - M, 42);

  setText(INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(30);
  pdf.text(t.reportTitle, M, 92);
  setText(BLUE);
  pdf.setFontSize(20);
  pdf.text(safe(companyTitle), M, 104);

  // Info-kaart
  const cy = 120;
  setFill(CARD_BG);
  setDraw(BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(M, cy, CW, 30, 3, 3, "FD");
  setText(MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(t.period.toUpperCase(), M + 8, cy + 10);
  pdf.text(t.generatedOn.toUpperCase(), M + 8 + CW / 2, cy + 10);
  setText(INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(periodLabel, M + 8, cy + 18);
  pdf.text(generatedOnText, M + 8 + CW / 2, cy + 18);

  setText(MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(t.confidential, M, PH - 16);

  // ── INHOUD ────────────────────────────────────────────────────────────
  for (const block of blocks) {
    pdf.addPage();
    pageHeader();
    chapter(block.heading);
    for (const section of block.sections) {
      if (section.type === "metrics") {
        if (!section.data.length) {
          sectionTitle(section.title);
          noData();
        } else {
          sectionTitle(section.title);
          kpiTiles(section.data);
        }
      } else if (section.type === "table") {
        if (!section.data.length) {
          sectionTitle(section.title);
          noData();
          continue;
        }
        const total = section.data.reduce((s, i) => s + i.value, 0);
        const rows = section.data.map((i) => {
          const pct =
            i.percentage !== undefined
              ? `${i.percentage.toFixed(0)}%`
              : total > 0
                ? `${((i.value / total) * 100).toFixed(0)}%`
                : "0%";
          return [i.name, String(i.value), pct];
        });
        dataTable(section.title, rows, [t.category, t.value, t.percentage]);
      } else if (section.type === "list") {
        if (!section.data.length) continue;
        const accent = /watch|aandacht|attenzione|attention|atención|achtung/i.test(
          section.title,
        )
          ? RED
          : GREEN;
        listCard(section.title, section.data, accent);
      } else {
        paragraphCard(section.title, section.data);
      }
    }
  }

  // ── FOOTERS ───────────────────────────────────────────────────────────
  const total = pdf.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    pdf.setPage(i);
    setDraw(BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(M, PH - 12, PW - M, PH - 12);
    setText(MUTED);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(t.confidential, M, PH - 7);
    pdf.text(`${t.page} ${i - 1} ${t.of} ${total - 1}`, PW - M, PH - 7, {
      align: "right",
    });
  }

  return Buffer.from(pdf.output("arraybuffer"));
}
