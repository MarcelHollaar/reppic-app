import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation, translations } from "@/lib/translations";

export interface DateSelection {
  year: string;
  month: string;
}

export function getCurrentDateSelection(): DateSelection {
  const now = new Date();
  return {
    year: now.getFullYear().toString(),
    month: "ytd"
  };
}

interface TimeFilterProps {
  selectedDate: DateSelection;
  onDateChange: (date: DateSelection) => void;
  className?: string;
}

function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return [(currentYear - 1).toString(), currentYear.toString(), (currentYear + 1).toString()];
}

const years = getYearOptions();

export function TimeFilter({ selectedDate, onDateChange, className }: TimeFilterProps) {
  const { language } = useLanguage();
  const t = useTranslation(language);

  const months = [
    { value: "ytd", label: t.yearToDate },
    { value: "01", label: t.january },
    { value: "02", label: t.february },
    { value: "03", label: t.march },
    { value: "04", label: t.april },
    { value: "05", label: t.may },
    { value: "06", label: t.june },
    { value: "07", label: t.july },
    { value: "08", label: t.august },
    { value: "09", label: t.september },
    { value: "10", label: t.october },
    { value: "11", label: t.november },
    { value: "12", label: t.december },
  ];

  return (
    <div className={`flex gap-3 ${className}`}>
      <Select 
        value={selectedDate.year} 
        onValueChange={(year) => onDateChange({ ...selectedDate, year })}
      >
        <SelectTrigger className="w-32" data-testid="select-year">
          <SelectValue placeholder={t.year} />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={year} data-testid={`option-year-${year}`}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select 
        value={selectedDate.month} 
        onValueChange={(month) => onDateChange({ ...selectedDate, month })}
      >
        <SelectTrigger className="w-44" data-testid="select-month">
          <SelectValue placeholder={t.month} />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value} data-testid={`option-month-${month.value}`}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function formatSelectedDate(date: DateSelection, language: string): string {
  const t = translations[language as keyof typeof translations] || translations.nl;
  if (date.month === "ytd") {
    return `${t.yearToDate} ${date.year}`;
  }
  const monthLabels = [t.january, t.february, t.march, t.april, t.may, t.june, t.july, t.august, t.september, t.october, t.november, t.december];
  const monthIndex = parseInt(date.month) - 1;
  const monthLabel = monthLabels[monthIndex] || date.month;
  return `${monthLabel} ${date.year}`;
}
