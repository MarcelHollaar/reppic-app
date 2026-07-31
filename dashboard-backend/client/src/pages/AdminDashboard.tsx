import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadZone } from "@/components/UploadZone";
import { TranscriptList } from "@/components/TranscriptList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { FileText, Calendar, Upload, Trash2, ImageIcon, Loader2, Copy, Check, RotateCcw, TrendingUp, Target, Brain, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Transcript as TranscriptType, PlanDocument } from "@shared/schema";

async function readFileContent(file: File): Promise<{ content: string; isPdf: boolean }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        resolve({ content: base64, isPdf: true });
      };
      reader.onerror = () => reject(new Error("Kan PDF niet lezen"));
      reader.readAsDataURL(file);
    });
  }
  const content = await file.text();
  return { content, isPdf: false };
}

interface Company {
  id: string;
  name: string;
  defaultLanguage: string | null;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);

  const { data: selectedTranscriptFull, isLoading: selectedTranscriptLoading } = useQuery<TranscriptType>({
    queryKey: ['/api/transcripts', selectedTranscriptId],
    enabled: !!selectedTranscriptId,
  });

  const hadActiveRef = useRef(false);

  const { data: transcripts = [] } = useQuery<TranscriptType[]>({
    queryKey: ['/api/transcripts'],
    refetchInterval: (query) => {
      const data = query.state.data as TranscriptType[] | undefined;
      if (!data) return false;
      const hasActive = data.some(t => t.status === 'pending' || t.status === 'processing');
      return hasActive ? 3000 : false;
    },
  });

  // When analyses finish, refresh all analytics caches
  useEffect(() => {
    const hasActive = transcripts.some(t => t.status === 'pending' || t.status === 'processing');
    if (hadActiveRef.current && !hasActive && transcripts.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/operational'] });
    }
    hadActiveRef.current = hasActive;
  }, [transcripts]);

  const { data: allPlans = [] } = useQuery<PlanDocument[]>({
    queryKey: ['/api/plans'],
  });

  const { data: logoData } = useQuery<{ logoUrl: string | null }>({
    queryKey: ['/api/brandkit/logo'],
  });

  const { data: company } = useQuery<Company>({
    queryKey: ['/api/company'],
    retry: false,
  });

  // selectedLang: what the user has picked in the selector (undefined = not yet loaded)
  // savedLang: the last value successfully persisted (used to detect unsaved changes)
  const [selectedLang, setSelectedLang] = useState<string | null | undefined>(undefined);
  const [savedLang, setSavedLang] = useState<string | null | undefined>(undefined);

  // Sync both states with the server value once loaded
  useEffect(() => {
    if (company !== undefined && selectedLang === undefined) {
      setSelectedLang(company.defaultLanguage ?? null);
      setSavedLang(company.defaultLanguage ?? null);
    }
  }, [company]);

  const resolvedLang = selectedLang !== undefined ? selectedLang : (company?.defaultLanguage ?? null);
  const resolvedSavedLang = savedLang !== undefined ? savedLang : (company?.defaultLanguage ?? null);

  const getWebhookUrl = () => {
    if (!company) return null;
    let url = `${window.location.origin}/api/webhooks/assemblyai?companyId=${company.id}`;
    if (resolvedLang) url += `&lang=${resolvedLang}`;
    return url;
  };

  const updateLanguageMutation = useMutation({
    mutationFn: async (defaultLanguage: string | null) => {
      if (!company) throw new Error("Geen bedrijf");
      return apiRequest("PATCH", `/api/companies/${company.id}`, { defaultLanguage });
    },
    onSuccess: (_data, defaultLanguage) => {
      setSavedLang(defaultLanguage);
      queryClient.invalidateQueries({ queryKey: ['/api/company'] });
      toast({
        title: t.defaultLanguageSaved || "Default language saved",
        description: t.defaultLanguageSavedDesc || "The default language has been updated",
      });
    },
    onError: () => {
      setSelectedLang(resolvedSavedLang);
      toast({
        title: t.defaultLanguageSaveFailed || "Save failed",
        variant: "destructive",
      });
    },
  });

  const strategicPlan = allPlans.find(p => p.planType === 'strategic' && p.language === language);
  const operationalPlan = allPlans.find(p => p.planType === 'operational' && p.language === language);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { content, isPdf } = await readFileContent(file);
      return apiRequest('POST', '/api/transcripts', {
        filename: file.name,
        content,
        isPdf,
        status: 'pending',
        language
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      toast({
        title: t.transcriptUploaded || "Transcript uploaded",
        description: t.aiAnalysisStarted || "AI analysis has started"
      });
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      if (error.message.includes('OpenAI API key')) {
        errorMessage = t.openaiKeyNotConfigured || "OpenAI API key is not configured. Please contact the administrator.";
      } else if (error.message.includes('quota') || error.message.includes('insufficient_quota')) {
        errorMessage = t.openaiQuotaExceeded || "OpenAI API quota exceeded. Add credit to your OpenAI account.";
      }
      toast({
        title: t.uploadFailed || "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const uploadPlanMutation = useMutation({
    mutationFn: async ({ file, planType }: { file: File; planType: 'strategic' | 'operational' }) => {
      const { content, isPdf } = await readFileContent(file);
      return apiRequest('POST', `/api/plans/${planType}`, {
        filename: file.name,
        content,
        isPdf,
        language
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/status'] });
      toast({
        title: t.planUploaded || "Plan uploaded",
        description: t.planUploadedDesc || "The plan has been saved and will be used in future analyses"
      });
    },
    onError: (error: any) => {
      toast({
        title: t.uploadFailed || "Upload failed",
        description: error.message,
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
        title: t.transcriptDeleted || "Transcript deleted",
        description: t.transcriptDeletedDesc || "The transcript has been successfully deleted"
      });
    },
    onError: (error: any) => {
      toast({
        title: t.deleteFailed || "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleUpload = (files: File[]) => {
    files.forEach(file => uploadMutation.mutate(file));
  };

  const handleStrategicPlanUpload = (files: File[]) => {
    if (files.length > 0) {
      uploadPlanMutation.mutate({ file: files[0], planType: 'strategic' });
    }
  };

  const handleOperationalPlanUpload = (files: File[]) => {
    if (files.length > 0) {
      uploadPlanMutation.mutate({ file: files[0], planType: 'operational' });
    }
  };

  const resetSnapshotMutation = useMutation({
    mutationFn: async (type: 'operational' | 'strategic') => {
      return apiRequest('DELETE', `/api/analytics/snapshots/${type}`);
    },
    onSuccess: (data: any, type) => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/operational'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      toast({
        title: type === 'operational'
          ? (t.resetOperationalSuccess || "Operationele data gewist")
          : (t.resetStrategicSuccess || "Strategische data gewist"),
        description: t.resetSnapshotDesc || "Upload je transcripten opnieuw om nieuwe gemiddelden op te bouwen.",
      });
    },
    onError: (error: any) => {
      toast({
        title: t.resetFailed || "Wissen mislukt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleView = (id: string) => {
    setSelectedTranscriptId(id);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: t.brandkitUploadError || "Upload failed",
        description: t.brandkitOnlyImages || "Only images are allowed",
        variant: "destructive"
      });
      return;
    }

    setLogoUploading(true);
    try {
      // Step 1: Get presigned URL
      const presignedResponse = await apiRequest('POST', '/api/object-storage/presigned-url', {
        filename: file.name,
        contentType: file.type,
        folder: 'brandkit'
      });
      const { presignedUrl, objectPath } = presignedResponse;

      // Step 2: Upload file directly to presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Save the logo URL
      await apiRequest('POST', '/api/brandkit/logo', { objectPath });

      queryClient.invalidateQueries({ queryKey: ['/api/brandkit/logo'] });
      toast({
        title: t.brandkitLogoUploaded || "Logo uploaded",
        description: t.brandkitLogoUploadedDesc || "Your company logo has been saved"
      });
    } catch (error: any) {
      toast({
        title: t.brandkitUploadError || "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleLogoDelete = async () => {
    try {
      await apiRequest('DELETE', '/api/brandkit/logo');
      queryClient.invalidateQueries({ queryKey: ['/api/brandkit/logo'] });
      toast({
        title: t.brandkitLogoDeleted || "Logo deleted",
        description: t.brandkitLogoDeletedDesc || "Your company logo has been deleted"
      });
    } catch (error: any) {
      toast({
        title: t.deleteFailed || "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const mapStatus = (backendStatus: string): 'pending' | 'processing' | 'analyzed' | 'error' => {
    switch (backendStatus) {
      case 'completed':
      case 'analyzed':
        return 'analyzed';
      case 'pending':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'error':
        return 'error';
      default:
        return 'processing';
    }
  };

  const mappedTranscripts = transcripts.map(transcript => ({
    id: String(transcript.id),
    filename: transcript.filename,
    date: transcript.uploadedAt ? new Date(transcript.uploadedAt).toLocaleDateString() : new Date().toLocaleDateString(),
    status: mapStatus(transcript.status),
    language: transcript.language ?? null
  }));

  const [filterLanguage, setFilterLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem("adminDashboard.languageFilter") ?? "all";
    } catch {
      return "all";
    }
  });

  const handleFilterLanguageChange = (value: string) => {
    setFilterLanguage(value);
    try {
      localStorage.setItem("adminDashboard.languageFilter", value);
    } catch {
      // ignore
    }
  };

  const availableLanguages = Array.from(
    new Set(mappedTranscripts.map(tr => tr.language).filter((l): l is string => !!l))
  ).sort();

  useEffect(() => {
    if (filterLanguage !== "all" && availableLanguages.length > 0 && !availableLanguages.includes(filterLanguage)) {
      handleFilterLanguageChange("all");
    }
  }, [availableLanguages, filterLanguage]);

  const filteredTranscripts = filterLanguage === "all"
    ? mappedTranscripts
    : mappedTranscripts.filter(tr => tr.language === filterLanguage);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(language === 'nl' ? 'nl-NL' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'it' ? 'it-IT' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const PlanStatus = ({ plan, planType }: { plan: PlanDocument | undefined; planType: 'strategic' | 'operational' }) => {
    if (!plan) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
          <FileText className="h-4 w-4" />
          <span>{t.noPlanUploaded || "No plan uploaded"}</span>
        </div>
      );
    }

    return (
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">{plan.filename}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(plan.uploadedAt)}</span>
              </div>
            </div>
          </div>
          <Badge variant="secondary">{t.currentPlan || "Current plan"}</Badge>
        </div>
      </div>
    );
  };

  const languageOptions = [
    { value: 'nl', label: t.langNl || "Dutch" },
    { value: 'en', label: t.langEn || "English" },
    { value: 'de', label: t.langDe || "German" },
    { value: 'fr', label: t.langFr || "French" },
    { value: 'es', label: t.langEs || "Spanish" },
    { value: 'it', label: t.langIt || "Italian" },
  ];

  const webhookUrl = getWebhookUrl();

  return (
    <div className="space-y-6">
      {(() => {
        const selectedTranscript = mappedTranscripts.find(tr => tr.id === selectedTranscriptId);

        let parsedAnalysis: { strategic?: any; operational?: any } | null = null;
        if (selectedTranscriptFull?.analysis) {
          try {
            parsedAnalysis = JSON.parse(selectedTranscriptFull.analysis);
          } catch {
            parsedAnalysis = null;
          }
        }

        const isAnalyzed = selectedTranscript?.status === 'analyzed';
        const strategic = parsedAnalysis?.strategic;
        const operational = parsedAnalysis?.operational;

        return (
          <Dialog open={!!selectedTranscript} onOpenChange={(open) => { if (!open) setSelectedTranscriptId(null); }}>
            <DialogContent className="max-w-2xl" data-testid="dialog-transcript-detail">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2" data-testid="text-transcript-filename">
                  {selectedTranscript?.filename}
                  {selectedTranscript?.language && (
                    <Badge variant="outline" className="text-xs font-mono uppercase" data-testid="badge-detail-language">
                      {selectedTranscript.language.toUpperCase()}
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span data-testid="text-transcript-date">{selectedTranscript?.date}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t.status}:</span>
                      {selectedTranscript && (
                        <span data-testid="text-transcript-status">
                          {selectedTranscript.status === 'analyzed' ? (
                            <Badge variant="secondary" className="bg-chart-2/20 text-chart-2 border-chart-2/30">{t.statusAnalyzed}</Badge>
                          ) : selectedTranscript.status === 'processing' ? (
                            <Badge variant="secondary" className="bg-chart-3/20 text-chart-3 border-chart-3/30">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />{t.statusProcessing}
                            </Badge>
                          ) : selectedTranscript.status === 'pending' ? (
                            <Badge variant="secondary" className="bg-chart-4/20 text-chart-4 border-chart-4/30">{t.statusPending}</Badge>
                          ) : (
                            <Badge variant="destructive">{t.statusError}</Badge>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t.transcriptLanguage}:</span>
                      {selectedTranscript?.language ? (
                        <Badge variant="outline" className="text-xs font-mono uppercase" data-testid="badge-detail-language-row">
                          {selectedTranscript.language.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {isAnalyzed && (
                    <>
                      <Separator />
                      {selectedTranscriptLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4" data-testid="text-analysis-loading">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading analysis…</span>
                        </div>
                      )}
                      {!selectedTranscriptLoading && !parsedAnalysis && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2" data-testid="text-analysis-unavailable">
                          <AlertCircle className="h-4 w-4" />
                          <span>No analysis results available.</span>
                        </div>
                      )}
                      {!selectedTranscriptLoading && parsedAnalysis && (() => {
                        const hasStrategicSummary = !!strategic?.executiveSummary;
                        const hasManagementPriorities = strategic?.managementPriorities?.length > 0;
                        const hasOperationalSummary = !!operational?.executiveSummary;
                        const hasCoachingPriorities = operational?.coachingPriorities?.length > 0;
                        const hasTrends = !!(strategic?.trends?.trendGroups &&
                          (Object.values(strategic.trends.trendGroups).flat() as any[]).length > 0);
                        const hasAnySections = hasStrategicSummary || hasManagementPriorities ||
                          hasOperationalSummary || hasCoachingPriorities || hasTrends;
                        return (
                        <div className="space-y-2" data-testid="section-analysis-results">
                          <p className="text-sm font-medium">Analysis Results</p>
                          {!hasAnySections ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2" data-testid="text-analysis-empty">
                              <AlertCircle className="h-4 w-4" />
                              <span>Analysis is stored but contains no displayable sections.</span>
                            </div>
                          ) : (
                          <Accordion type="multiple" defaultValue={["strategic-summary", "management-priorities"]} className="w-full">
                            {strategic?.executiveSummary && (
                              <AccordionItem value="strategic-summary">
                                <AccordionTrigger className="text-sm gap-2" data-testid="accordion-strategic-summary">
                                  <span className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                    Strategic Summary
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-strategic-summary">
                                    {strategic.executiveSummary}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            {strategic?.managementPriorities?.length > 0 && (
                              <AccordionItem value="management-priorities">
                                <AccordionTrigger className="text-sm gap-2" data-testid="accordion-management-priorities">
                                  <span className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                                    Management Priorities
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3" data-testid="list-management-priorities">
                                    {strategic.managementPriorities.map((p: any, i: number) => (
                                      <div key={i} className="space-y-1" data-testid={`item-management-priority-${i}`}>
                                        <p className="text-sm font-medium">{i + 1}. {p.priority}</p>
                                        {p.whyNow && (
                                          <p className="text-xs text-muted-foreground">{p.whyNow}</p>
                                        )}
                                        {p.nextStep && (
                                          <p className="text-xs text-chart-2">Next step: {p.nextStep}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            {operational?.executiveSummary && (
                              <AccordionItem value="operational-summary">
                                <AccordionTrigger className="text-sm gap-2" data-testid="accordion-operational-summary">
                                  <span className="flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
                                    Operational Summary
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-operational-summary">
                                    {operational.executiveSummary}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            {operational?.coachingPriorities?.length > 0 && (
                              <AccordionItem value="coaching-priorities">
                                <AccordionTrigger className="text-sm gap-2" data-testid="accordion-coaching-priorities">
                                  <span className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                                    Coaching Priorities
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3" data-testid="list-coaching-priorities">
                                    {operational.coachingPriorities.map((p: any, i: number) => (
                                      <div key={i} className="space-y-1" data-testid={`item-coaching-priority-${i}`}>
                                        <p className="text-sm font-medium">{i + 1}. {p.priority}</p>
                                        {p.observation && (
                                          <p className="text-xs text-muted-foreground">{p.observation}</p>
                                        )}
                                        {p.coachingTip && (
                                          <p className="text-xs text-chart-2">Tip: {p.coachingTip}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            )}
                            {strategic?.trends?.trendGroups && (() => {
                              const groups = strategic.trends.trendGroups;
                              const allTrends = Object.values(groups).flat() as any[];
                              const topTrends = allTrends.sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 5);
                              if (topTrends.length === 0) return null;
                              return (
                                <AccordionItem value="top-trends">
                                  <AccordionTrigger className="text-sm gap-2" data-testid="accordion-top-trends">
                                    <span className="flex items-center gap-2">
                                      <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                      Top Trends
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-2" data-testid="list-top-trends">
                                      {topTrends.map((trend: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between gap-2" data-testid={`item-trend-${i}`}>
                                          <span className="text-sm">{trend.name}</span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {trend.type && (
                                              <Badge variant="outline" className="text-xs">
                                                {trend.type}
                                              </Badge>
                                            )}
                                            <span className="text-sm font-mono text-muted-foreground">{trend.value}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })()}
                          </Accordion>
                          )}
                        </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        );
      })()}

      <div>
        <h1 className="text-2xl font-semibold mb-1">{t.admin}</h1>
        <p className="text-sm text-muted-foreground">
          {t.adminDesc}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.admin}</CardTitle>
          <CardDescription>{t.adminDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transcripts" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="transcripts" data-testid="tab-transcripts">{t.uploadTranscripts}</TabsTrigger>
              <TabsTrigger value="strategic" data-testid="tab-strategic">{t.strategicPlan || "Strategic Plan"}</TabsTrigger>
              <TabsTrigger value="operational" data-testid="tab-operational">{t.operationalPlan || "Operational Plan"}</TabsTrigger>
              <TabsTrigger value="brandkit" data-testid="tab-brandkit">{t.brandkit}</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">{t.companySettings || "Company Settings"}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcripts" className="mt-4 space-y-4">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" data-testid="tab-upload">{t.upload}</TabsTrigger>
                  <TabsTrigger value="list" data-testid="tab-list">{t.uploadedFiles}</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-4">
                  <UploadZone 
                    onUpload={handleUpload}
                    title={t.dragTranscriptsHere}
                    description={t.supportedFormats}
                    accept=".txt,.doc,.docx,.pdf"
                  />
                  {uploadMutation.isPending && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      {t.uploading}
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="list" className="mt-4 space-y-3">
                  {mappedTranscripts.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t.filterByLanguage}:</span>
                      <Select value={filterLanguage} onValueChange={handleFilterLanguageChange}>
                        <SelectTrigger className="w-44" data-testid="select-language-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" data-testid="select-option-all">{t.allLanguages}</SelectItem>
                          {availableLanguages.map(lang => (
                            <SelectItem key={lang} value={lang} data-testid={`select-option-${lang}`}>
                              {lang.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <TranscriptList 
                    transcripts={filteredTranscripts}
                    onDelete={handleDelete}
                    onView={handleView}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="strategic" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t.strategicPlanDesc || "Document for strategic dashboards (Trends, Customer Satisfaction, Competition, Proposition)"}
                </p>
                
                <PlanStatus plan={strategicPlan} planType="strategic" />
                
                <UploadZone 
                  onUpload={handleStrategicPlanUpload}
                  title={strategicPlan ? (t.replacePlan || "Replace plan") : (t.uploadStrategicPlan || "Upload Strategic Plan")}
                  description={t.supportedFormats}
                  accept=".txt,.doc,.docx,.pdf"
                />
                {uploadPlanMutation.isPending && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    {t.uploading}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="operational" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t.operationalPlanDesc || "Document for operational dashboards (Activity, PICA, Deal Health, Team, Resistance, Next Step)"}
                </p>
                
                <PlanStatus plan={operationalPlan} planType="operational" />
                
                <UploadZone 
                  onUpload={handleOperationalPlanUpload}
                  title={operationalPlan ? (t.replacePlan || "Replace plan") : (t.uploadOperationalPlan || "Upload Operational Sales Plan")}
                  description={t.supportedFormats}
                  accept=".txt,.doc,.docx,.pdf"
                />
                {uploadPlanMutation.isPending && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    {t.uploading}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="brandkit" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t.brandkitDesc}
                </p>
                
                <div className="border rounded-lg p-6">
                  <h3 className="font-medium mb-4">{t.brandkitCompanyLogo}</h3>
                  
                  {logoData?.logoUrl ? (
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-6 flex items-center justify-center">
                        <img 
                          src={logoData.logoUrl} 
                          alt="Company logo" 
                          className="max-h-24 max-w-full object-contain"
                          data-testid="img-company-logo"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          data-testid="button-replace-logo"
                        >
                          {logoUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {t.brandkitReplaceLogo || "Replace logo"}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={handleLogoDelete}
                          data-testid="button-delete-logo"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t.brandkitDeleteLogo || "Delete logo"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover-elevate"
                      onClick={() => logoInputRef.current?.click()}
                      data-testid="upload-logo-dropzone"
                    >
                      {logoUploading ? (
                        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      )}
                      <p className="text-sm font-medium">{t.brandkitUploadLogo}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.brandkitLogoFormats || "PNG, JPG, SVG up to 2MB"}</p>
                    </div>
                  )}
                  
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    data-testid="input-logo-file"
                  />
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {t.brandkitLogoUsage}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {t.companySettingsDesc || "Configure the default settings for your company"}
                </p>

                <div className="border rounded-lg p-6 space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">{t.defaultLanguage || "Default language"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.defaultLanguageDesc || "The default language is used as a fallback for webhook transcript processing and pre-fills the lang parameter in the webhook URL."}
                    </p>
                    <div className="flex items-center gap-3">
                      <Select
                        value={resolvedLang ?? "none"}
                        onValueChange={(val) => {
                          const resolved = val === "none" ? null : val;
                          setSelectedLang(resolved);
                        }}
                        disabled={!company || updateLanguageMutation.isPending}
                        data-testid="select-default-language"
                      >
                        <SelectTrigger className="w-56" data-testid="trigger-default-language">
                          <SelectValue placeholder={t.defaultLanguageNone || "No default language"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" data-testid="option-lang-none">
                            {t.defaultLanguageNone || "No default language"}
                          </SelectItem>
                          {languageOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} data-testid={`option-lang-${opt.value}`}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => updateLanguageMutation.mutate(resolvedLang)}
                        disabled={
                          !company ||
                          updateLanguageMutation.isPending ||
                          resolvedLang === resolvedSavedLang
                        }
                        data-testid="button-save-language"
                      >
                        {updateLanguageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {t.saveChanges || "Save changes"}
                      </Button>
                    </div>
                  </div>

                  {company && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-medium mb-1">{t.webhookUrlLabel || "Webhook URL"}</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {t.webhookUrlHint || "Use this URL for the AssemblyAI webhook. The language parameter is automatically filled in based on the chosen default language."}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 bg-muted/50 rounded-md px-3 py-2">
                          <span
                            className="font-mono text-xs text-muted-foreground break-all"
                            data-testid="text-webhook-url"
                          >
                            {webhookUrl}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                if (webhookUrl) {
                                  navigator.clipboard.writeText(webhookUrl).then(() => {
                                    setCopiedUrl(true);
                                    setTimeout(() => setCopiedUrl(false), 2000);
                                  });
                                }
                              }}
                              data-testid="button-copy-webhook-url"
                            >
                              {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {copiedUrl ? (t.urlCopied || "Copied!") : (t.copyUrl || "Copy URL")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2" data-testid="text-webhook-lang-note">
                        {resolvedLang
                          ? (() => {
                              const langLabel = languageOptions.find(o => o.value === resolvedLang)?.label ?? resolvedLang;
                              return (
                                <>
                                  {t.webhookLangNotePrefix || "No lang param → processed as"} <strong>{langLabel}</strong> ({resolvedLang})
                                </>
                              );
                            })()
                          : <span className="text-amber-600 dark:text-amber-400" data-testid="text-webhook-no-lang">
                              {t.webhookNoLang || "No default language — add &lang= to the URL"}
                            </span>
                        }
                      </p>
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-6 space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">{t.resetAnalyticsTitle || "Analytics data wissen"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.resetAnalyticsDesc || "Wis gecumuleerde analyse-snapshots wanneer de opgeslagen waarden onjuist zijn (bijv. optellingen in plaats van gemiddelden). Na het wissen worden nieuwe gemiddelden opgebouwd zodra je transcripten opnieuw uploadt of analyseert."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => resetSnapshotMutation.mutate('operational')}
                        disabled={resetSnapshotMutation.isPending}
                        data-testid="button-reset-operational-snapshots"
                      >
                        {resetSnapshotMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        {t.resetOperational || "Operationeel resetten"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => resetSnapshotMutation.mutate('strategic')}
                        disabled={resetSnapshotMutation.isPending}
                        data-testid="button-reset-strategic-snapshots"
                      >
                        {resetSnapshotMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        {t.resetStrategic || "Strategisch resetten"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
