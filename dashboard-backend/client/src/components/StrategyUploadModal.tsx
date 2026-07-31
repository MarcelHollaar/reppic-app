import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadZone } from "./UploadZone";
import { FileText } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StrategyDocument } from "@shared/schema";

interface StrategyUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StrategyUploadModal({ open, onOpenChange }: StrategyUploadModalProps) {
  const { toast } = useToast();
  
  const { data: documents = [] } = useQuery<StrategyDocument[]>({
    queryKey: ['/api/strategy-documents'],
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      return apiRequest('POST', '/api/strategy-documents', {
        filename: file.name,
        content
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategy-documents'] });
      toast({
        title: "Strategie document geüpload",
        description: "Het document is beschikbaar voor referentie bij analyse"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload mislukt",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleUpload = (files: File[]) => {
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const latestDocument = documents[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Strategie Document Uploaden</DialogTitle>
          <DialogDescription>
            Upload een strategie document voor referentie bij de analyse
          </DialogDescription>
        </DialogHeader>

        {latestDocument ? (
          <div className="border rounded-lg p-6 bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{latestDocument.filename}</p>
                <p className="text-sm text-muted-foreground">
                  Geüpload op {new Date(latestDocument.uploadedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <UploadZone 
            onUpload={handleUpload}
            title="Sleep strategie document hier of klik om te selecteren"
            description="Ondersteunde formaten: .pdf, .docx, .doc, .txt"
            accept=".pdf,.docx,.doc,.txt"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
