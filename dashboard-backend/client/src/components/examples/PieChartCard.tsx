import { PieChartCard } from "../PieChartCard";

const mockData = [
  { name: "Snelheid", value: 35, color: "hsl(var(--chart-1))" },
  { name: "Gebruiksvriendelijkheid", value: 28, color: "hsl(var(--chart-2))" },
  { name: "Prijs", value: 22, color: "hsl(var(--chart-3))" },
  { name: "Support", value: 15, color: "hsl(var(--chart-4))" },
];

export default function PieChartCardExample() {
  return (
    <div className="p-8 grid gap-6 md:grid-cols-2">
      <PieChartCard title="Behoeften (Aantallen)" data={mockData} />
      <PieChartCard title="Behoeften (Percentages)" data={mockData} showPercentage />
    </div>
  );
}
