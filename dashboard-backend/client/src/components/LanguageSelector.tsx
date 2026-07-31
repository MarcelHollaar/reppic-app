import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Language = "nl" | "en" | "de" | "fr" | "es" | "it";

interface LanguageSelectorProps {
  value: Language;
  onValueChange: (value: Language) => void;
}

const languages = [
  { value: "nl" as const, label: "Nederlands" },
  { value: "en" as const, label: "English" },
  { value: "de" as const, label: "Deutsch" },
  { value: "fr" as const, label: "Français" },
  { value: "es" as const, label: "Español" },
  { value: "it" as const, label: "Italiano" },
];

export function LanguageSelector({ value, onValueChange }: LanguageSelectorProps) {
  const selectedLanguage = languages.find((lang) => lang.value === value);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-44" data-testid="select-language">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          <SelectValue>
            <span>{selectedLanguage?.label}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem 
            key={lang.value} 
            value={lang.value}
            data-testid={`option-lang-${lang.value}`}
          >
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
