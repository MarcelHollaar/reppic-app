import { TrendingUp, Heart, Target, Lightbulb, Settings, BarChart3, ShieldAlert, CheckCircle, Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useAuth } from "@/lib/AuthContext";
import reppicLogo from "@assets/Reppic (7)_1759432699720.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const strategicMenuItems = [
  {
    key: "trends" as const,
    url: "/",
    icon: TrendingUp,
  },
  {
    key: "customerSatisfaction" as const,
    url: "/customer-satisfaction",
    icon: Heart,
  },
  {
    key: "competition" as const,
    url: "/competition",
    icon: Target,
  },
  {
    key: "proposition" as const,
    url: "/proposition",
    icon: Lightbulb,
  },
];

const operationalMenuItems = [
  {
    key: "picaPerformance" as const,
    url: "/operational/pica",
    icon: BarChart3,
  },
  {
    key: "resistanceNeeds" as const,
    url: "/operational/resistance",
    icon: ShieldAlert,
  },
  {
    key: "nextStepDiscipline" as const,
    url: "/operational/next-steps",
    icon: CheckCircle,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const { user } = useAuth();

  const queryParams = window.location.search;
  
  const isOperational = location.startsWith("/operational");
  const menuItems = isOperational ? operationalMenuItems : strategicMenuItems;
  const menuLabel = isOperational ? t.operationalDashboard : t.strategicDashboard;

  return (
    <Sidebar>
      <SidebarContent className="px-4 pt-2 pb-4">
        <div className="mb-0 px-2">
          <img 
            src={reppicLogo} 
            alt="Reppic" 
            className="h-40 w-auto object-contain"
          />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>{menuLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.key.toLowerCase()}`}>
                    <Link href={`${item.url}${queryParams}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{t[item.key]}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t.management}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/admin"} data-testid="link-admin">
                  <Link href={`/admin${queryParams}`}>
                    <Settings className="w-4 h-4" />
                    <span>{t.management}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user?.role === "superadmin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/superadmin"} data-testid="link-superadmin">
                    <Link href="/superadmin">
                      <Building2 className="w-4 h-4" />
                      <span>{t.companyManagement}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
