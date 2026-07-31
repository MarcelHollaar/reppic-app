import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LanguageProvider, useLanguage } from "@/lib/LanguageContext";
import { DateProvider } from "@/lib/DateContext";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { TwoFactorSetupModal } from "@/components/TwoFactorSetupModal";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Transcript } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, LogOut, User, Building2, ChevronDown, UserCircle, Loader2, CheckCircle2 } from "lucide-react";
import TrendsDashboard from "@/pages/TrendsDashboard";
import CustomerSatisfactionDashboard from "@/pages/CustomerSatisfactionDashboard";
import CompetitionDashboard from "@/pages/CompetitionDashboard";
import PropositionDashboard from "@/pages/PropositionDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import PicaPerformanceDashboard from "@/pages/operational/PicaPerformanceDashboard";
import ResistanceNeedsDashboard from "@/pages/operational/ResistanceNeedsDashboard";
import NextStepDisciplineDashboard from "@/pages/operational/NextStepDisciplineDashboard";
import SuperAdminPage from "@/pages/SuperAdminPage";
import ProfilePage from "@/pages/ProfilePage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={TrendsDashboard} />
      <Route path="/customer-satisfaction" component={CustomerSatisfactionDashboard} />
      <Route path="/competition" component={CompetitionDashboard} />
      <Route path="/proposition" component={PropositionDashboard} />
      <Route path="/operational/pica" component={PicaPerformanceDashboard} />
      <Route path="/operational/resistance" component={ResistanceNeedsDashboard} />
      <Route path="/operational/next-steps" component={NextStepDisciplineDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/superadmin" component={SuperAdminPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [, setLocation] = useLocation();

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-user-menu">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">{user.username}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setLocation("/profile")}
            data-testid="menu-item-profile"
          >
            <UserCircle className="w-4 h-4 mr-2" />
            Mijn profiel
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTwoFAOpen(true)}
            data-testid="menu-item-2fa"
          >
            <Shield className="w-4 h-4 mr-2" />
            Twee-factor beveiliging
          </DropdownMenuItem>
          {user.role === "superadmin" && (
            <DropdownMenuItem
              onClick={() => setLocation("/superadmin")}
              data-testid="menu-item-superadmin"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Bedrijfsbeheer
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="text-destructive focus:text-destructive"
            data-testid="menu-item-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Uitloggen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TwoFactorSetupModal open={twoFAOpen} onClose={() => setTwoFAOpen(false)} />
    </>
  );
}

function useAnalyticsRefresher() {
  const { user } = useAuth();
  const hadActiveRef = useRef(false);

  const { data: transcripts = [] } = useQuery<Transcript[]>({
    queryKey: ['/api/transcripts'],
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as Transcript[] | undefined;
      if (!data) return 60000; // initial: poll every 60s to catch incoming webhooks
      const hasActive = data.some(t => t.status === 'pending' || t.status === 'processing');
      return hasActive ? 4000 : 60000; // fast poll while processing, slow poll otherwise
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (!user || transcripts.length === 0) return;
    const hasActive = transcripts.some(t => t.status === 'pending' || t.status === 'processing');
    if (hasActive) {
      hadActiveRef.current = true;
    } else if (hadActiveRef.current) {
      hadActiveRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/operational'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
    }
  }, [transcripts, user]);
}

function useReanalysisStatus() {
  const { user } = useAuth();
  const { language } = useLanguage();

  return useQuery<{ state: string; processed: number; total: number }>({
    queryKey: ['/api/reanalysis/status', language],
    queryFn: async () => {
      const res = await fetch(`/api/reanalysis/status/${language}`);
      return res.json();
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as { state: string } | undefined;
      if (!data) return false;
      return data.state === 'running' ? 3000 : false;
    },
    staleTime: 0,
  });
}

function ReanalysisBanner() {
  const { data: status } = useReanalysisStatus();
  const [visible, setVisible] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const prevState = useRef<string>('idle');

  useEffect(() => {
    if (!status) return;
    if (status.state === 'running') {
      setVisible(true);
      setJustCompleted(false);
    } else if (status.state === 'complete' && prevState.current === 'running') {
      setJustCompleted(true);
      setVisible(true);
      const queryClient_ = queryClient;
      queryClient_.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
      queryClient_.invalidateQueries({ queryKey: ['/api/analytics/operational'] });
      setTimeout(() => setVisible(false), 4000);
    }
    prevState.current = status.state;
  }, [status]);

  if (!visible || !status || status.state === 'idle') return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-sm">
      {justCompleted ? (
        <>
          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-foreground font-medium">
            Herberekening voltooid — dashboards zijn bijgewerkt met het nieuwe plan.
          </span>
        </>
      ) : (
        <>
          <Loader2 className="w-4 h-4 text-primary flex-shrink-0 animate-spin" />
          <span className="text-foreground font-medium">
            Herberekening nieuwe data...
          </span>
          {status.total > 0 && (
            <span className="text-muted-foreground">
              {status.processed} van {status.total} transcripties verwerkt
            </span>
          )}
        </>
      )}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { language, setLanguage } = useLanguage();
  useAnalyticsRefresher();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <LanguageSelector value={language} onValueChange={setLanguage} />
              <UserMenu />
            </div>
          </header>
          <ReanalysisBanner />
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl mx-auto p-6">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <LanguageProvider>
            <DateProvider>
              <AppContent />
            </DateProvider>
          </LanguageProvider>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
