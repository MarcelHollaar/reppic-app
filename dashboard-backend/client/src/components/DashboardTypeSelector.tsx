import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";

export type DashboardType = "strategic" | "operational";

interface DashboardTypeSelectorProps {
  currentType: DashboardType;
  onSwitch: () => void;
  className?: string;
}

export function DashboardTypeSelector({ currentType, onSwitch, className }: DashboardTypeSelectorProps) {
  const { language } = useLanguage();
  const t = useTranslation(language);

  const targetLabel = currentType === "strategic" 
    ? t.operationalDashboard 
    : t.strategicDashboard;

  return (
    <Button 
      variant="outline" 
      onClick={onSwitch}
      className={className}
      data-testid="button-switch-dashboard"
    >
      <ArrowRightLeft className="w-4 h-4 mr-2" />
      {targetLabel}
    </Button>
  );
}
