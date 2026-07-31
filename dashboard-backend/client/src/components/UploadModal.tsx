import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadZone } from "./UploadZone";
import { TranscriptList, Transcript } from "./TranscriptList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/LanguageContext";
import type { Transcript as TranscriptType } from "@shared/schema";
import { useEffect, useRef } from "react";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const hadActiveRef = useRef(false);
  
  const { data: transcripts = [] } = useQuery<TranscriptType[]>({
    queryKey: ['/api/transcripts'],
    enabled: open,
    // Poll every 3 seconds while the modal is open and transcripts are being processed
    refetchInterval: (query) => {
      if (!open) return false;
      const data = query.state.data as TranscriptType[] | undefined;
      if (!data) return false;
      const hasActive = data.some(t => t.status === 'pending' || t.status === 'processing');
      return hasActive ? 3000 : false;
    },
  });

  // When all transcripts finish processing, refresh analytics so dashboards show new data
  useEffect(() => {
    if (!open || transcripts.length === 0) return;
    const hasActive = transcripts.some(t => t.status === 'pending' || t.status === 'processing');
    if (hasActive) {
      hadActiveRef.current = true;
    } else if (hadActiveRef.current) {
      // Transitioned from active → all done: invalidate analytics cache
      hadActiveRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/operational'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
    }
  }, [transcripts, open]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      return apiRequest('POST', '/api/transcripts', {
        filename: file.name,
        content,
        status: 'pending',
        language
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      toast({
        title: "Transcript geüpload",
        description: "De AI-analyse is gestart"
      });
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      if (error.message.includes('OpenAI API key')) {
        errorMessage = "OpenAI API key is niet geconfigureerd. Neem contact op met de beheerder.";
      } else if (error.message.includes('quota') || error.message.includes('insufficient_quota')) {
        errorMessage = "OpenAI API quota overschreden. Voeg krediet toe aan je OpenAI account.";
      }
      toast({
        title: "Upload mislukt",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/transcripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      toast({
        title: "Transcript verwijderd",
        description: "Het transcript is succesvol verwijderd"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verwijderen mislukt",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleUpload = (files: File[]) => {
    files.forEach(file => uploadMutation.mutate(file));
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleView = (id: string) => {
    console.log("Viewing transcript:", id);
  };

  const formattedTranscripts: Transcript[] = transcripts.map(t => ({
    id: t.id,
    filename: t.filename,
    date: new Date(t.uploadedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }),
    status: t.status === 'completed' ? 'analyzed' : (t.status === 'failed' || t.status === 'error') ? 'error' : 'processing'
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transcripties Beheren</DialogTitle>
          <DialogDescription>
            Upload verkoopgesprek transcripties voor AI-analyse
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-list">Transcripties</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="flex-1">
            <UploadZone onUpload={handleUpload} />
          </TabsContent>
          
          <TabsContent value="list" className="flex-1 overflow-auto">
            <TranscriptList
              transcripts={formattedTranscripts}
              onDelete={handleDelete}
              onView={handleView}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
