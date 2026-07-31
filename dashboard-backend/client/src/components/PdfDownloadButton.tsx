import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { generatePdfReport, type ReportData, type ReportSection, type TableData, type MetricData } from "@/lib/reportBuilder";
import type { Language } from "@/components/LanguageSelector";

const toastTranslations = {
  nl: {
    pdfDownloaded: "PDF Gedownload",
    reportSaved: "rapport is opgeslagen",
    error: "Fout",
    failedToGenerate: "Kon PDF rapport niet genereren",
  },
  en: {
    pdfDownloaded: "PDF Downloaded",
    reportSaved: "report has been saved",
    error: "Error",
    failedToGenerate: "Failed to generate PDF report",
  },
  de: {
    pdfDownloaded: "PDF Heruntergeladen",
    reportSaved: "Bericht wurde gespeichert",
    error: "Fehler",
    failedToGenerate: "PDF-Bericht konnte nicht erstellt werden",
  },
  fr: {
    pdfDownloaded: "PDF Téléchargé",
    reportSaved: "rapport a été enregistré",
    error: "Erreur",
    failedToGenerate: "Impossible de générer le rapport PDF",
  },
  es: {
    pdfDownloaded: "PDF Descargado",
    reportSaved: "informe ha sido guardado",
    error: "Error",
    failedToGenerate: "No se pudo generar el informe PDF",
  },
  it: {
    pdfDownloaded: "PDF Scaricato",
    reportSaved: "report è stato salvato",
    error: "Errore",
    failedToGenerate: "Impossibile generare il report PDF",
  },
};

interface PdfDownloadButtonProps {
  dashboardTitle: string;
  dashboardSubtitle: string;
  period: string;
  conclusion?: string;
  sections: ReportSection[];
  language: Language;
  dashboardType: "strategic" | "operational";
  buttonText: string;
}

export function PdfDownloadButton({ 
  dashboardTitle,
  dashboardSubtitle,
  period,
  conclusion,
  sections,
  language,
  dashboardType,
  buttonText
}: PdfDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const t = toastTranslations[language] || toastTranslations.en;
  
  const { data: logoData } = useQuery<{ logoUrl: string | null }>({
    queryKey: ['/api/brandkit/logo'],
  });

  const handleDownload = async () => {
    setIsGenerating(true);

    try {
      const reportData: ReportData = {
        title: dashboardTitle,
        subtitle: dashboardSubtitle,
        period: period,
        conclusion: conclusion,
        sections: sections,
      };

      await generatePdfReport(reportData, language, dashboardType, logoData?.logoUrl);

      toast({
        title: t.pdfDownloaded,
        description: `${dashboardTitle} ${t.reportSaved}`,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: t.error,
        description: t.failedToGenerate,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleDownload} 
      disabled={isGenerating}
      data-testid="button-download-pdf"
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      {buttonText}
    </Button>
  );
}

export type { ReportSection, TableData, MetricData };
