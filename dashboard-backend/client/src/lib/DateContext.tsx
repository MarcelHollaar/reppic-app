import { createContext, useContext, useState } from "react";
import { DateSelection, getCurrentDateSelection } from "@/components/TimeFilter";

interface DateContextValue {
  selectedDate: DateSelection;
  setSelectedDate: (date: DateSelection) => void;
}

const DateContext = createContext<DateContextValue | null>(null);

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<DateSelection>(getCurrentDateSelection());
  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDateSelection(): DateContextValue {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error("useDateSelection must be used within DateProvider");
  return ctx;
}
