import { useState } from "react";
import { TimePeriodSelector, TimePeriod } from "../TimePeriodSelector";

export default function TimePeriodSelectorExample() {
  const [selected, setSelected] = useState<TimePeriod>("1M");

  return (
    <div className="p-8">
      <TimePeriodSelector selected={selected} onSelect={setSelected} />
    </div>
  );
}
