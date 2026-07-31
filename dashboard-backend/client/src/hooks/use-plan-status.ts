import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/LanguageContext";

interface PlanStatusItem {
  active: boolean;
  filename?: string;
  uploadedAt?: string;
}

interface PlanStatus {
  strategic: PlanStatusItem;
  operational: PlanStatusItem;
}

export function usePlanStatus() {
  const { language } = useLanguage();
  
  const { data: planStatus } = useQuery<PlanStatus>({
    queryKey: ['/api/plans/status', language],
    queryFn: async () => {
      const res = await fetch(`/api/plans/status/${language}`);
      if (!res.ok) return { strategic: { active: false }, operational: { active: false } };
      return res.json();
    }
  });

  return {
    strategicPlanActive: planStatus?.strategic?.active ?? false,
    operationalPlanActive: planStatus?.operational?.active ?? false,
    planStatus
  };
}
