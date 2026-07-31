import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Line, LineChart, ResponsiveContainer } from "recharts";

interface DetailItem {
  name: string;
  value: number;
  suffix?: string;
  severity?: string;
  type?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  sparklineData?: number[];
  className?: string;
  detailItems?: DetailItem[];
  detailTitle?: string;
}

export function MetricCard({ title, value, change, sparklineData, className, detailItems, detailTitle }: MetricCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isPositive = (change ?? 0) >= 0;
  const showChange = change !== undefined;
  const chartData = sparklineData?.map((value, index) => ({ value, index })) || [];
  const hasDetails = detailItems && detailItems.length > 0;
  const maxValue = hasDetails ? Math.max(...detailItems.map(d => d.value)) : 0;

  return (
    <>
      <Card
        className={cn(
          "hover-elevate",
          hasDetails && "cursor-pointer",
          className
        )}
        onClick={hasDetails ? () => setDialogOpen(true) : undefined}
        data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {hasDetails && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-3xl font-bold font-mono" data-testid={`metric-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </div>
            
            {showChange && (
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    isPositive ? "text-chart-2" : "text-destructive"
                  )}
                  data-testid={`metric-change-${title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {isPositive ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(change!)}%</span>
                </div>
                <span className="text-xs text-muted-foreground">vs vorig jaar</span>
              </div>
            )}

            {sparklineData && sparklineData.length > 0 && (
              <div className="h-12 -mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {hasDetails && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{detailTitle || title}</DialogTitle>
              <DialogDescription>
                {title}: {value}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {detailItems.map((item, idx) => {
                const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1" data-testid={`detail-item-${idx}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <span className="text-sm font-mono font-semibold text-muted-foreground whitespace-nowrap">
                        {item.value}{item.suffix || 'x'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          item.severity === "high" ? "bg-destructive" :
                          item.severity === "medium" ? "bg-amber-500" :
                          item.type === "positive" ? "bg-chart-2" :
                          "bg-primary"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
