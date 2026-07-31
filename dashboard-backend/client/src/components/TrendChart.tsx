import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Maximize2 } from "lucide-react";

interface TrendChartProps {
  title: string;
  data: Array<{
    month: string;
    rolling: number;
    thisYear: number;
    lastYear: number;
  }>;
  className?: string;
}

export function TrendChart({ title, data, className }: TrendChartProps) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const t = useTranslation(language);

  const chartContent = (height: string, fontSize: number) => (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis
            dataKey="month"
            stroke="hsl(var(--muted-foreground))"
            fontSize={fontSize}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={fontSize}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="rolling"
            name={t.rollingTimeline}
            stroke="hsl(var(--chart-2))"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="thisYear"
            name={t.thisYear}
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="lastYear"
            name={t.lastYear}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <Card
        className={`${className} cursor-pointer hover-elevate group relative`}
        onClick={() => setOpen(true)}
        data-testid={`trend-chart-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="absolute top-3 right-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors z-10">
          <Maximize2 className="w-4 h-4" />
        </div>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartContent("h-80", 12)}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl" data-testid={`trend-dialog-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {chartContent("h-[500px]", 13)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
