import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Trash2, Loader2, Users, Eye, EyeOff, ShieldCheck, KeyRound, Copy, Check, Link, Upload, FileText, X, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/AuthContext";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LANGUAGE_OPTIONS = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
];

interface Company {
  id: string;
  name: string;
  defaultLanguage: string | null;
  createdAt: string;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  companyId: string | null;
  role: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export default function SuperAdminPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [createOpen, setCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pwDialog, setPwDialog] = useState<{ open: boolean; userId: string; username: string }>({ open: false, userId: "", username: "" });
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "", show: false });
  const [pwError, setPwError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    phone: "",
    mobile: "",
    password: "",
  });
  const [formError, setFormError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [webhookTestStatus, setWebhookTestStatus] = useState<Record<string, { loading: boolean; ok?: boolean; code?: number; error?: string }>>({});
  const [localLanguages, setLocalLanguages] = useState<Record<string, string | null>>({});
  const [savingCompanyId, setSavingCompanyId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState<string>("");
  const [uploadLanguage, setUploadLanguage] = useState<string>("nl");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === "superadmin",
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery<UserRecord[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "superadmin",
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/companies", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Aanmaken mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/companies"] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Bedrijf aangemaakt", description: `${form.companyName} is succesvol aangemaakt.` });
      setCreateOpen(false);
      setForm({ companyName: "", email: "", phone: "", mobile: "", password: "" });
      setFormError("");
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/companies/${id}`);
      if (!res.ok) throw new Error("Verwijderen mislukt");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/companies"] });
    },
    onError: () => {
      toast({ title: "Fout", description: "Bedrijf kon niet worden verwijderd.", variant: "destructive" });
    },
  });

  const updateLanguageMutation = useMutation({
    mutationFn: async ({ id, defaultLanguage }: { id: string; defaultLanguage: string | null; previousLanguage?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/companies/${id}`, { defaultLanguage });
      if (!res.ok) throw new Error("Bijwerken mislukt");
      return res.json();
    },
    onMutate: ({ id }) => {
      setSavingCompanyId(id);
    },
    onSuccess: (_, { id }) => {
      setSavingCompanyId(null);
      qc.invalidateQueries({ queryKey: ["/api/companies"] });
      setLocalLanguages(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onError: (_, { id, previousLanguage }) => {
      setSavingCompanyId(null);
      toast({ title: "Fout", description: "Taalvoorkeur kon niet worden opgeslagen.", variant: "destructive" });
      setLocalLanguages(prev => {
        const next = { ...prev };
        if (previousLanguage === undefined) {
          delete next[id];
        } else {
          next[id] = previousLanguage;
        }
        return next;
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      if (!res.ok) throw new Error("Verwijderen mislukt");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Gebruiker verwijderd" });
    },
    onError: () => {
      toast({ title: "Fout", description: "Gebruiker kon niet worden verwijderd.", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/password`, { newPassword });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Wijzigen mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Wachtwoord gewijzigd", description: `Het wachtwoord van ${pwDialog.username} is bijgewerkt.` });
      setPwDialog({ open: false, userId: "", username: "" });
      setPwForm({ newPassword: "", confirmPassword: "", show: false });
      setPwError("");
    },
    onError: (err: Error) => {
      setPwError(err.message);
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (pwForm.newPassword.length < 6) {
      setPwError("Wachtwoord moet minimaal 6 tekens bevatten");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("Wachtwoorden komen niet overeen");
      return;
    }
    changePasswordMutation.mutate({ userId: pwDialog.userId, newPassword: pwForm.newPassword });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (form.password.length < 8) {
      setFormError("Wachtwoord moet minimaal 8 tekens bevatten");
      return;
    }
    createCompanyMutation.mutate(form);
  };

  const readFileContent = async (file: File): Promise<{ content: string; isPdf: boolean }> => {
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
  };

  const uploadTranscriptMutation = useMutation({
    mutationFn: async ({ file, companyId, language }: { file: File; companyId: string; language: string }) => {
      const { content, isPdf } = await readFileContent(file);
      const res = await apiRequest("POST", "/api/transcripts", {
        filename: file.name,
        content,
        isPdf,
        status: "pending",
        language,
        targetCompanyId: companyId,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transcript geüpload", description: "De AI-analyse is gestart voor het geselecteerde bedrijf." });
      setUploadOpen(false);
      setUploadFile(null);
    },
    onError: (err: Error) => {
      toast({ title: "Upload mislukt", description: err.message, variant: "destructive" });
    },
  });

  const getWebhookUrl = (company: Company) => {
    const lang = company.defaultLanguage;
    let url = `${window.location.origin}/api/webhooks/assemblyai?companyId=${company.id}`;
    if (lang) url += `&lang=${lang}`;
    return url;
  };

  const getResolvedLang = (company: Company): string | null => {
    return company.defaultLanguage;
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return null;
    return companies.find(c => c.id === companyId)?.name ?? companyId;
  };

  const roleLabel = (role: string) => {
    if (role === "superadmin") return <Badge variant="default">Superadmin</Badge>;
    if (role === "admin") return <Badge variant="secondary">Admin</Badge>;
    return <Badge variant="outline">Gebruiker</Badge>;
  };

  if (user && user.role !== "superadmin") {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Superadmin — Bedrijfsbeheer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Beheer bedrijven en gebruikersaccounts
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              setUploadFile(null);
              setUploadCompanyId(companies[0]?.id ?? "");
              setUploadLanguage(companies[0]?.defaultLanguage ?? "nl");
              setUploadOpen(true);
            }}
            disabled={companies.length === 0}
            data-testid="button-upload-transcript"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload transcript
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-company">
              <Plus className="w-4 h-4 mr-2" />
              Nieuw bedrijf
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bedrijf aanmaken</DialogTitle>
              <DialogDescription>
                Maak een nieuw bedrijf aan met een beheerderaccount
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="company-name">Bedrijfsnaam *</Label>
                <Input
                  id="company-name"
                  placeholder="Naam van het bedrijf"
                  value={form.companyName}
                  onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))}
                  required
                  data-testid="input-company-name"
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Beheerderaccount
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email">E-mailadres * <span className="text-muted-foreground font-normal">(wordt ook de gebruikersnaam)</span></Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="naam@bedrijf.nl"
                      value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                      required
                      data-testid="input-admin-email"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-phone">Telefoonnummer</Label>
                      <Input
                        id="admin-phone"
                        type="tel"
                        placeholder="+31 20 000 0000"
                        value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                        data-testid="input-phone"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-mobile">Mobielnummer</Label>
                      <Input
                        id="admin-mobile"
                        type="tel"
                        placeholder="+31 6 0000 0000"
                        value={form.mobile}
                        onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))}
                        data-testid="input-mobile"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-password">Wachtwoord *</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimaal 8 tekens"
                        value={form.password}
                        onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                        required
                        className="pr-10"
                        data-testid="input-admin-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-destructive" data-testid="text-form-error">{formError}</p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setCreateOpen(false); setFormError(""); }}
                >
                  Annuleren
                </Button>
                <Button
                  type="submit"
                  disabled={createCompanyMutation.isPending}
                  data-testid="button-submit-company"
                >
                  {createCompanyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Aanmaken"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Companies table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bedrijven
            <Badge variant="secondary" className="ml-auto">{companies.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCompanies ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              Nog geen bedrijven aangemaakt
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedrijfsnaam</TableHead>
                  <TableHead>Webhook ID</TableHead>
                  <TableHead>Webhook URL</TableHead>
                  <TableHead>Standaardtaal</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="font-mono text-xs text-muted-foreground cursor-default"
                              data-testid={`text-company-id-${company.id}`}
                            >
                              {company.id.slice(0, 8)}&hellip;
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm break-all font-mono text-xs">
                            {company.id}
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(company.id).then(() => {
                              setCopiedId(company.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }).catch(() => {
                              toast({ title: "Kopiëren mislukt", description: "Sta klembordtoegang toe in je browser.", variant: "destructive" });
                            });
                          }}
                          title="Kopieer volledige ID"
                          data-testid={`button-copy-id-${company.id}`}
                        >
                          {copiedId === company.id
                            ? <Check className="w-3 h-3 text-green-600" />
                            : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="font-mono text-xs text-muted-foreground truncate max-w-[160px] cursor-default"
                                data-testid={`text-webhook-url-${company.id}`}
                              >
                                {getWebhookUrl(company)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm break-all font-mono text-xs">
                              {getWebhookUrl(company)}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(getWebhookUrl(company)).then(() => {
                                setCopiedUrl(company.id);
                                setTimeout(() => setCopiedUrl(null), 2000);
                              }).catch(() => {
                                toast({ title: "Kopiëren mislukt", description: "Sta klembordtoegang toe in je browser.", variant: "destructive" });
                              });
                            }}
                            title="Kopieer webhook-URL"
                            data-testid={`button-copy-url-${company.id}`}
                          >
                            {copiedUrl === company.id
                              ? <Check className="w-3 h-3 text-green-600" />
                              : <Link className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            disabled={webhookTestStatus[company.id]?.loading}
                            onClick={async () => {
                              setWebhookTestStatus(prev => ({ ...prev, [company.id]: { loading: true } }));
                              try {
                                const res = await apiRequest("POST", `/api/companies/${company.id}/test-webhook`);
                                const data = await res.json();
                                if (data.ok) {
                                  setWebhookTestStatus(prev => ({ ...prev, [company.id]: { loading: false, ok: true, code: data.status } }));
                                } else {
                                  setWebhookTestStatus(prev => ({ ...prev, [company.id]: { loading: false, ok: false, code: data.status, error: data.error } }));
                                }
                              } catch {
                                setWebhookTestStatus(prev => ({ ...prev, [company.id]: { loading: false, ok: false, error: "Verbinding mislukt" } }));
                              }
                            }}
                            title="Test webhook bereikbaarheid"
                            data-testid={`button-test-webhook-${company.id}`}
                          >
                            {webhookTestStatus[company.id]?.loading
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Wifi className="w-3 h-3" />}
                          </Button>
                        </div>
                        {webhookTestStatus[company.id] && !webhookTestStatus[company.id].loading && (
                          <div
                            className="flex items-center gap-1"
                            data-testid={`status-webhook-test-${company.id}`}
                          >
                            {webhookTestStatus[company.id].ok ? (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 border-green-500 text-green-600 dark:text-green-400">
                                <Check className="w-2.5 h-2.5 mr-1" />
                                {webhookTestStatus[company.id].code} OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 border-destructive text-destructive">
                                <X className="w-2.5 h-2.5 mr-1" />
                                {webhookTestStatus[company.id].error ?? `${webhookTestStatus[company.id].code ?? ""} Fout`}
                              </Badge>
                            )}
                          </div>
                        )}
                        {(() => {
                          const lang = getResolvedLang(company);
                          const langLabel = lang
                            ? LANGUAGE_OPTIONS.find(o => o.value === lang)?.label ?? lang
                            : null;
                          return langLabel ? (
                            <span
                              className="text-xs text-muted-foreground"
                              data-testid={`text-webhook-lang-note-${company.id}`}
                            >
                              Geen lang param → verwerkt als <strong>{langLabel}</strong> ({lang})
                            </span>
                          ) : (
                            <span
                              className="text-xs text-muted-foreground/60"
                              data-testid={`text-webhook-lang-note-${company.id}`}
                            >
                              Geen standaardtaal — voeg &amp;lang= toe aan de URL
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={(company.id in localLanguages ? (localLanguages[company.id] ?? "none") : (company.defaultLanguage ?? "none"))}
                          onValueChange={(val) => {
                            const resolved = val === "none" ? null : val;
                            setLocalLanguages(prev => ({ ...prev, [company.id]: resolved }));
                          }}
                        >
                          <SelectTrigger
                            className="h-8 w-36 text-xs"
                            data-testid={`select-language-${company.id}`}
                          >
                            <SelectValue placeholder="Geen voorkeur" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Geen voorkeur</span>
                            </SelectItem>
                            {LANGUAGE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={
                            savingCompanyId === company.id ||
                            !(company.id in localLanguages) ||
                            localLanguages[company.id] === company.defaultLanguage
                          }
                          onClick={() => {
                            const resolved = localLanguages[company.id] ?? null;
                            updateLanguageMutation.mutate({
                              id: company.id,
                              defaultLanguage: resolved,
                              previousLanguage: company.defaultLanguage,
                            });
                          }}
                          data-testid={`button-save-language-${company.id}`}
                        >
                          {savingCompanyId === company.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          Opslaan
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(company.createdAt).toLocaleDateString("nl-NL")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteCompanyMutation.mutate(company.id)}
                        disabled={deleteCompanyMutation.isPending}
                        data-testid={`button-delete-company-${company.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Gebruikers
            <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Alle gebruikersaccounts in het systeem
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{u.username}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {(u.phone || u.mobile) && (
                          <p className="text-xs text-muted-foreground">
                            {u.phone && <span>{u.phone}</span>}
                            {u.phone && u.mobile && <span> · </span>}
                            {u.mobile && <span>{u.mobile}</span>}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getCompanyName(u.companyId) ?? <span className="italic">—</span>}
                    </TableCell>
                    <TableCell>{roleLabel(u.role)}</TableCell>
                    <TableCell>
                      {u.twoFactorEnabled ? (
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {u.role !== "superadmin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setPwDialog({ open: true, userId: u.id, username: u.username });
                              setPwForm({ newPassword: "", confirmPassword: "", show: false });
                              setPwError("");
                            }}
                            data-testid={`button-change-password-${u.id}`}
                            title="Wachtwoord wijzigen"
                          >
                            <KeyRound className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                        {u.role !== "superadmin" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteUserMutation.mutate(u.id)}
                            disabled={deleteUserMutation.isPending}
                            data-testid={`button-delete-user-${u.id}`}
                            title="Gebruiker verwijderen"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload transcript dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) setUploadFile(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transcript uploaden voor bedrijf</DialogTitle>
            <DialogDescription>
              Upload een transcript namens een specifiek bedrijf. De AI-analyse start automatisch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Bedrijf *</Label>
              <Select
                value={uploadCompanyId}
                onValueChange={(val) => {
                  setUploadCompanyId(val);
                  const co = companies.find(c => c.id === val);
                  if (co?.defaultLanguage) setUploadLanguage(co.defaultLanguage);
                }}
              >
                <SelectTrigger data-testid="select-upload-company">
                  <SelectValue placeholder="Kies een bedrijf" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Taal *</Label>
              <Select value={uploadLanguage} onValueChange={setUploadLanguage}>
                <SelectTrigger data-testid="select-upload-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bestand *</Label>
              {uploadFile ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{uploadFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setUploadFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center gap-3 border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate"
                  data-testid="upload-zone-superadmin"
                >
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.docx,.doc,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadFile(f);
                    }}
                    data-testid="input-upload-file"
                  />
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Klik om een bestand te selecteren</p>
                    <p className="text-xs text-muted-foreground mt-0.5">.txt, .docx, .doc, .pdf</p>
                  </div>
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setUploadOpen(false); setUploadFile(null); }}
              >
                Annuleren
              </Button>
              <Button
                type="button"
                disabled={!uploadFile || !uploadCompanyId || uploadTranscriptMutation.isPending}
                onClick={() => {
                  if (uploadFile && uploadCompanyId) {
                    uploadTranscriptMutation.mutate({ file: uploadFile, companyId: uploadCompanyId, language: uploadLanguage });
                  }
                }}
                data-testid="button-confirm-upload"
              >
                {uploadTranscriptMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Uploaden"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password change dialog */}
      <Dialog open={pwDialog.open} onOpenChange={(open) => !open && setPwDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wachtwoord wijzigen</DialogTitle>
            <DialogDescription>
              Stel een nieuw wachtwoord in voor <strong>{pwDialog.username}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">Nieuw wachtwoord</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={pwForm.show ? "text" : "password"}
                  placeholder="Minimaal 6 tekens"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="pr-10"
                  data-testid="input-admin-new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setPwForm(f => ({ ...f, show: !f.show }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {pwForm.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Bevestig wachtwoord</Label>
              <Input
                id="confirm-pw"
                type={pwForm.show ? "text" : "password"}
                placeholder="Herhaal wachtwoord"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                data-testid="input-admin-confirm-password"
                required
              />
            </div>
            {pwError && (
              <p className="text-sm text-destructive" data-testid="text-pw-error">{pwError}</p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwDialog(d => ({ ...d, open: false }))}
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                data-testid="button-confirm-change-password"
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Opslaan"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
