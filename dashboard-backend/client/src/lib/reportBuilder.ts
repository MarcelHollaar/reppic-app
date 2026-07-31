import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Language } from "@/components/LanguageSelector";

interface ReportData {
  title: string;
  subtitle: string;
  period: string;
  conclusion?: string;
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  type: "table" | "metrics" | "text";
  data: TableData[] | MetricData[] | string;
}

interface TableData {
  name: string;
  value: number;
  percentage?: number;
}

interface MetricData {
  label: string;
  value: string | number;
}

const reportTranslations = {
  nl: {
    reportTitle: "Sales Analytics Rapport",
    generatedOn: "Gegenereerd op",
    period: "Periode",
    executiveSummary: "Samenvatting",
    dataOverview: "Data Overzicht",
    category: "Categorie",
    value: "Waarde",
    percentage: "Percentage",
    total: "Totaal",
    metric: "Metric",
    page: "Pagina",
    of: "van",
    confidential: "Vertrouwelijk",
    strategicReport: "Strategisch Rapport",
    operationalReport: "Operationeel Rapport",
    noDataAvailable: "Geen data beschikbaar",
    keyInsights: "Belangrijkste Inzichten",
    recommendations: "Aanbevelingen",
  },
  en: {
    reportTitle: "Sales Analytics Report",
    generatedOn: "Generated on",
    period: "Period",
    executiveSummary: "Executive Summary",
    dataOverview: "Data Overview",
    category: "Category",
    value: "Value",
    percentage: "Percentage",
    total: "Total",
    metric: "Metric",
    page: "Page",
    of: "of",
    confidential: "Confidential",
    strategicReport: "Strategic Report",
    operationalReport: "Operational Report",
    noDataAvailable: "No data available",
    keyInsights: "Key Insights",
    recommendations: "Recommendations",
  },
  de: {
    reportTitle: "Vertriebsanalyse-Bericht",
    generatedOn: "Erstellt am",
    period: "Zeitraum",
    executiveSummary: "Zusammenfassung",
    dataOverview: "Datenübersicht",
    category: "Kategorie",
    value: "Wert",
    percentage: "Prozentsatz",
    total: "Gesamt",
    metric: "Metrik",
    page: "Seite",
    of: "von",
    confidential: "Vertraulich",
    strategicReport: "Strategischer Bericht",
    operationalReport: "Operativer Bericht",
    noDataAvailable: "Keine Daten verfügbar",
    keyInsights: "Wichtigste Erkenntnisse",
    recommendations: "Empfehlungen",
  },
  fr: {
    reportTitle: "Rapport d'Analyse des Ventes",
    generatedOn: "Généré le",
    period: "Période",
    executiveSummary: "Résumé Exécutif",
    dataOverview: "Aperçu des Données",
    category: "Catégorie",
    value: "Valeur",
    percentage: "Pourcentage",
    total: "Total",
    metric: "Métrique",
    page: "Page",
    of: "de",
    confidential: "Confidentiel",
    strategicReport: "Rapport Stratégique",
    operationalReport: "Rapport Opérationnel",
    noDataAvailable: "Aucune donnée disponible",
    keyInsights: "Points Clés",
    recommendations: "Recommandations",
  },
  es: {
    reportTitle: "Informe de Análisis de Ventas",
    generatedOn: "Generado el",
    period: "Período",
    executiveSummary: "Resumen Ejecutivo",
    dataOverview: "Resumen de Datos",
    category: "Categoría",
    value: "Valor",
    percentage: "Porcentaje",
    total: "Total",
    metric: "Métrica",
    page: "Página",
    of: "de",
    confidential: "Confidencial",
    strategicReport: "Informe Estratégico",
    operationalReport: "Informe Operacional",
    noDataAvailable: "No hay datos disponibles",
    keyInsights: "Información Clave",
    recommendations: "Recomendaciones",
  },
  it: {
    reportTitle: "Report Analisi Vendite",
    generatedOn: "Generato il",
    period: "Periodo",
    executiveSummary: "Sommario Esecutivo",
    dataOverview: "Panoramica Dati",
    category: "Categoria",
    value: "Valore",
    percentage: "Percentuale",
    total: "Totale",
    metric: "Metrica",
    page: "Pagina",
    of: "di",
    confidential: "Riservato",
    strategicReport: "Report Strategico",
    operationalReport: "Report Operativo",
    noDataAvailable: "Nessun dato disponibile",
    keyInsights: "Punti Chiave",
    recommendations: "Raccomandazioni",
  },
};

function getReportTranslation(language: Language) {
  return reportTranslations[language] || reportTranslations.en;
}

function formatDate(language: Language): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const localeMap: Record<Language, string> = {
    nl: 'nl-NL',
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT'
  };
  
  return date.toLocaleDateString(localeMap[language], options);
}

export async function generatePdfReport(
  reportData: ReportData,
  language: Language,
  dashboardType: "strategic" | "operational",
  logoUrl?: string | null
): Promise<void> {
  const t = getReportTranslation(language);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  const primaryColor: [number, number, number] = [41, 128, 185];
  const secondaryColor: [number, number, number] = [52, 73, 94];
  const lightGray: [number, number, number] = [236, 240, 241];
  const textColor: [number, number, number] = [44, 62, 80];

  let currentY = margin;
  
  let logoDataUrl: string | null = null;
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to load logo for PDF:', e);
    }
  }

  function addCoverPage() {
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, 80, "F");

    pdf.setFillColor(...lightGray);
    pdf.rect(0, 80, pageWidth, pageHeight - 80, "F");

    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'AUTO', margin, 15, 30, 30);
      } catch (e) {
        console.error('Failed to add logo to PDF:', e);
      }
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.setFont("helvetica", "bold");
    pdf.text(t.reportTitle, pageWidth / 2, 35, { align: "center" });

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "normal");
    const reportType = dashboardType === "strategic" ? t.strategicReport : t.operationalReport;
    pdf.text(reportType, pageWidth / 2, 50, { align: "center" });

    pdf.setTextColor(...textColor);
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.text(reportData.title, pageWidth / 2, 120, { align: "center" });

    if (reportData.subtitle) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text(reportData.subtitle, pageWidth / 2, 135, { align: "center" });
    }

    pdf.setFillColor(...primaryColor);
    pdf.rect(margin, 155, contentWidth, 0.5, "F");

    pdf.setFontSize(12);
    pdf.setTextColor(...secondaryColor);
    pdf.text(`${t.period}: ${reportData.period}`, pageWidth / 2, 175, { align: "center" });
    pdf.text(`${t.generatedOn}: ${formatDate(language)}`, pageWidth / 2, 185, { align: "center" });

    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text(t.confidential, pageWidth / 2, pageHeight - 20, { align: "center" });
  }

  function addPageHeader(title: string) {
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, 15, "F");
    
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'AUTO', 5, 2, 11, 11);
      } catch (e) {
        console.error('Failed to add logo to page header:', e);
      }
    }
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(t.reportTitle, logoDataUrl ? 20 : margin, 10);
    
    pdf.setFont("helvetica", "normal");
    pdf.text(title, pageWidth - margin, 10, { align: "right" });
    
    currentY = 25;
  }

  function addPageFooter(pageNum: number, totalPages: number) {
    pdf.setFillColor(...lightGray);
    pdf.rect(0, pageHeight - 12, pageWidth, 12, "F");
    
    pdf.setTextColor(...secondaryColor);
    pdf.setFontSize(9);
    pdf.text(
      `${t.page} ${pageNum} ${t.of} ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );
    
    pdf.text(t.confidential, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  function checkPageBreak(requiredHeight: number): boolean {
    if (currentY + requiredHeight > pageHeight - 30) {
      return true;
    }
    return false;
  }

  function addNewPage(title: string) {
    pdf.addPage();
    addPageHeader(title);
  }

  function addSectionTitle(title: string) {
    if (checkPageBreak(20)) {
      addNewPage(reportData.title);
    }
    
    pdf.setFillColor(...secondaryColor);
    pdf.rect(margin, currentY, 4, 8, "F");
    
    pdf.setTextColor(...secondaryColor);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin + 8, currentY + 6);
    
    currentY += 15;
  }

  function addExecutiveSummary(conclusion: string) {
    addSectionTitle(t.executiveSummary);
    
    pdf.setFillColor(245, 247, 250);
    
    pdf.setTextColor(...textColor);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    const lines = pdf.splitTextToSize(conclusion, contentWidth - 10);
    const boxHeight = Math.max(lines.length * 5 + 10, 30);
    
    if (checkPageBreak(boxHeight + 10)) {
      addNewPage(reportData.title);
    }
    
    pdf.roundedRect(margin, currentY, contentWidth, boxHeight, 3, 3, "F");
    
    pdf.text(lines, margin + 5, currentY + 8);
    
    currentY += boxHeight + 10;
  }

  function addDataTable(section: ReportSection) {
    addSectionTitle(section.title);
    
    const data = section.data as TableData[];
    
    if (!data || data.length === 0) {
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(10);
      pdf.text(t.noDataAvailable, margin, currentY);
      currentY += 10;
      return;
    }
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    const tableData = data.map((item) => {
      const percentage = item.percentage !== undefined 
        ? `${item.percentage.toFixed(1)}%`
        : total > 0 
          ? `${((item.value / total) * 100).toFixed(1)}%`
          : "0%";
      return [
        item.name,
        item.value.toString(),
        percentage
      ];
    });
    
    if (total > 0) {
      tableData.push([
        t.total,
        total.toString(),
        "100%"
      ]);
    }
    
    autoTable(pdf, {
      startY: currentY,
      head: [[t.category, t.value, t.percentage]],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: textColor,
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250],
      },
      footStyles: {
        fillColor: lightGray,
        fontStyle: "bold",
      },
      didParseCell: function(data) {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = lightGray;
        }
      },
    });
    
    currentY = (pdf as any).lastAutoTable.finalY + 15;
  }

  function addMetricsSection(section: ReportSection) {
    addSectionTitle(section.title);
    
    const metrics = section.data as MetricData[];
    
    if (!metrics || metrics.length === 0) {
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(10);
      pdf.text(t.noDataAvailable, margin, currentY);
      currentY += 10;
      return;
    }
    
    const tableData = metrics.map((metric) => [
      metric.label,
      metric.value.toString()
    ]);
    
    autoTable(pdf, {
      startY: currentY,
      head: [[t.metric, t.value]],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: textColor,
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250],
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.6 },
        1: { cellWidth: contentWidth * 0.4, halign: 'right' },
      },
    });
    
    currentY = (pdf as any).lastAutoTable.finalY + 15;
  }

  function addTextSection(section: ReportSection) {
    addSectionTitle(section.title);
    
    const text = section.data as string;
    
    if (!text) {
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(10);
      pdf.text(t.noDataAvailable, margin, currentY);
      currentY += 10;
      return;
    }
    
    pdf.setTextColor(...textColor);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    const lines = pdf.splitTextToSize(text, contentWidth);
    
    if (checkPageBreak(lines.length * 5 + 10)) {
      addNewPage(reportData.title);
    }
    
    pdf.text(lines, margin, currentY);
    currentY += lines.length * 5 + 10;
  }

  addCoverPage();

  pdf.addPage();
  addPageHeader(reportData.title);

  if (reportData.conclusion) {
    addExecutiveSummary(reportData.conclusion);
  }

  for (const section of reportData.sections) {
    switch (section.type) {
      case "table":
        addDataTable(section);
        break;
      case "metrics":
        addMetricsSection(section);
        break;
      case "text":
        addTextSection(section);
        break;
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    addPageFooter(i - 1, totalPages - 1);
  }

  const filename = `${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${reportData.period}.pdf`;
  pdf.save(filename);
}

export type { ReportData, ReportSection, TableData, MetricData };
