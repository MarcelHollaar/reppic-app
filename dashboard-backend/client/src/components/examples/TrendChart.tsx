import { TrendChart } from "../TrendChart";

const mockData = [
  { month: "Jan", rolling: 65, thisYear: 58, lastYear: 52 },
  { month: "Feb", rolling: 70, thisYear: 68, lastYear: 55 },
  { month: "Mrt", rolling: 72, thisYear: 72, lastYear: 58 },
  { month: "Apr", rolling: 78, thisYear: 75, lastYear: 62 },
  { month: "Mei", rolling: 82, thisYear: 80, lastYear: 65 },
  { month: "Jun", rolling: 85, thisYear: 85, lastYear: 68 },
];

export default function TrendChartExample() {
  return (
    <div className="p-8 max-w-4xl">
      <TrendChart title="Conversie Trend" data={mockData} />
    </div>
  );
}
