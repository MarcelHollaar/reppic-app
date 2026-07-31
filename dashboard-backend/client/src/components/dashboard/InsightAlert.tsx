/**
 * InsightAlert
 *
 * Compacte alertstrip voor een inzichtitem.
 * Toont alleen als er tekst aanwezig is (anders null).
 * Visueel opvallend maar niet schreeuwerig: amber tint.
 */

import { AlertTriangle, Info, AlertCircle } from "lucide-react";

export type AlertVariant = 'warning' | 'info' | 'error';

export interface InsightAlertProps {
  text: string;
  variant?: AlertVariant;
  /** Extra padding links (bijv. voor uitlijning met item-rijen). */
  indent?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<AlertVariant, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  textClass: string;
  wrapClass: string;
}> = {
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-500 dark:text-amber-400",
    textClass: "text-amber-800 dark:text-amber-300",
    wrapClass: "",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-500 dark:text-blue-400",
    textClass: "text-blue-800 dark:text-blue-300",
    wrapClass: "",
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-destructive",
    textClass: "text-destructive",
    wrapClass: "",
  },
};

export function InsightAlert({ text, variant = 'warning', indent = false, className = "" }: InsightAlertProps) {
  if (!text) return null;
  const s = VARIANT_STYLES[variant];
  const Icon = s.icon;

  return (
    <div
      className={`flex items-start gap-1 ${indent ? 'pl-3.5' : ''} ${className}`}
      data-testid="insight-alert"
    >
      <Icon className={`w-2.5 h-2.5 flex-shrink-0 mt-0.5 ${s.iconClass}`} />
      <span className={`text-[9px] leading-snug ${s.textClass}`}>{text}</span>
    </div>
  );
}

/** Gegroepeerde alertstrip (meerdere berichten in één blok, voor kaarthoofdsecties). */
export function InsightAlertBlock({ alerts, className = "" }: { alerts: string[]; className?: string }) {
  if (!alerts.length) return null;
  return (
    <div
      className={`rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 space-y-1 ${className}`}
      data-testid="insight-alert-block"
    >
      {alerts.map((text, i) => (
        <InsightAlert key={i} text={text} />
      ))}
    </div>
  );
}
