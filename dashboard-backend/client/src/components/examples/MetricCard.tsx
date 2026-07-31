import { MetricCard } from "../MetricCard";

export default function MetricCardExample() {
  const mockData = [45, 52, 48, 60, 58, 65, 70];

  return (
    <div className="p-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        title="Conversie Ratio"
        value="34.2%"
        change={12.5}
        sparklineData={mockData}
      />
      <MetricCard
        title="Gemiddelde Deal Size"
        value="€42.5K"
        change={-8.3}
        sparklineData={mockData.map(v => v * 1.2)}
      />
      <MetricCard
        title="Win Rate"
        value="67%"
        change={5.8}
        sparklineData={mockData.map(v => v * 0.9)}
      />
    </div>
  );
}
