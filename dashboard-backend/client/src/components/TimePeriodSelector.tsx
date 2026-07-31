import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TimePeriod = "7D" | "1M" | "3M" | "6M" | "1Y" | "YTD";

interface TimePeriodSelectorProps {
  selected: TimePeriod;
  onSelect: (period: TimePeriod) => void;
  className?: string;
}

const periods: TimePeriod[] = ["7D", "1M", "3M", "6M", "1Y", "YTD"];

export function TimePeriodSelector({ selected, onSelect, className }: TimePeriodSelectorProps) {
  return (
    <div className={cn("inline-flex rounded-lg border bg-muted/50 p-1", className)}>
      {periods.map((period) => (
        <Button
          key={period}
          variant={selected === period ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelect(period)}
          className={cn(
            "px-3 h-8 text-xs font-medium transition-all",
            selected !== period && "text-muted-foreground hover:text-foreground"
          )}
          data-testid={`button-period-${period.toLowerCase()}`}
        >
          {period}
        </Button>
      ))}
    </div>
  );
}
