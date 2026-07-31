import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";

export type TranscriptStatus = "pending" | "processing" | "analyzed" | "completed" | "error";

export interface Transcript {
  id: string;
  filename: string;
  date: string;
  status: TranscriptStatus;
  language?: string | null;
}

interface TranscriptListProps {
  transcripts: Transcript[];
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  className?: string;
}

export function TranscriptList({ transcripts, onDelete, onView, className }: TranscriptListProps) {
  const { language } = useLanguage();
  const t = useTranslation(language);

  const getStatusBadge = (status: TranscriptStatus) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-chart-4/20 text-chart-4 border-chart-4/30">
            {t.statusPending}
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="bg-chart-3/20 text-chart-3 border-chart-3/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t.statusProcessing}
          </Badge>
        );
      case "analyzed":
      case "completed":
        return (
          <Badge variant="secondary" className="bg-chart-2/20 text-chart-2 border-chart-2/30">
            {t.statusAnalyzed}
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            {t.statusError}
          </Badge>
        );
    }
  };

  const getLanguageBadge = (lang: string | null | undefined) => {
    if (!lang) return null;
    return (
      <Badge variant="outline" className="text-xs font-mono uppercase" data-testid={`badge-language-${lang}`}>
        {lang.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className={cn("rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.filename}</TableHead>
            <TableHead>{t.date}</TableHead>
            <TableHead>{t.status}</TableHead>
            <TableHead>{t.transcriptLanguage}</TableHead>
            <TableHead className="text-right">{t.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transcripts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                {t.noTranscripts}
              </TableCell>
            </TableRow>
          ) : (
            transcripts.map((transcript) => (
              <TableRow key={transcript.id} data-testid={`row-transcript-${transcript.id}`}>
                <TableCell className="font-medium">{transcript.filename}</TableCell>
                <TableCell className="text-muted-foreground">{transcript.date}</TableCell>
                <TableCell>{getStatusBadge(transcript.status)}</TableCell>
                <TableCell>{getLanguageBadge(transcript.language)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onView(transcript.id)}
                      disabled={transcript.status === "processing" || transcript.status === "pending"}
                      data-testid={`button-view-${transcript.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(transcript.id)}
                      data-testid={`button-delete-${transcript.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
