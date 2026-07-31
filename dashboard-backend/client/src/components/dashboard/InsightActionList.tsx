/**
 * InsightActionList
 *
 * Geeft een geparseerde tekst terug als gegroepeerde rolkaarten:
 *   Management · Sales manager · Team
 *
 * Verwacht een tekst in het formaat:
 *   "Management: actie A\nSales manager: actie B\nTeam: actie C"
 *
 * Als de tekst niet parseerbaar is, valt het terug op een gewone alinea.
 */

import { Building2, UserCog, Users, Zap } from "lucide-react";

export interface RoleAction {
  role: string;
  action: string;
}

export interface InsightActionListProps {
  /** Ruwe actietekst (wordt geparseerd op rol-patronen). */
  text: string;
  /** Optionele sectietitel boven het blok. */
  heading?: string;
  className?: string;
}

const ROLE_STYLES = [
  {
    icon: Building2,
    iconClass: "text-violet-500 dark:text-violet-400",
    labelClass: "text-violet-700 dark:text-violet-300",
    wrapClass: "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30",
  },
  {
    icon: UserCog,
    iconClass: "text-blue-500 dark:text-blue-400",
    labelClass: "text-blue-700 dark:text-blue-300",
    wrapClass: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Users,
    iconClass: "text-green-600 dark:text-green-400",
    labelClass: "text-green-700 dark:text-green-300",
    wrapClass: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
  },
];

export function parseRoleActions(text: string): RoleAction[] | null {
  const lines = text.split(/\n|;\s*/).map(l => l.trim()).filter(Boolean);
  const results: RoleAction[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-zÀ-ÿ][\w\s\-éèêëàâùûüïîôç]{1,35}):\s*(.+)$/i);
    if (match) results.push({ role: match[1].trim(), action: match[2].trim() });
  }
  return results.length >= 2 ? results : null;
}

export function InsightActionList({ text, heading, className = "" }: InsightActionListProps) {
  if (!text) return null;

  const roleActions = parseRoleActions(text);

  return (
    <div
      className={`rounded-md border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3.5 py-3 space-y-2.5 ${className}`}
      data-testid="insight-action-list"
    >
      {heading && (
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-primary">{heading}</p>
        </div>
      )}

      {roleActions ? (
        <div className="space-y-2">
          {roleActions.map((ra, i) => {
            const rs = ROLE_STYLES[i % ROLE_STYLES.length];
            const RIcon = rs.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 ${rs.wrapClass}`}
                data-testid={`action-role-${i}`}
              >
                <RIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${rs.iconClass}`} />
                <div className="min-w-0">
                  <span className={`block text-[9px] font-semibold uppercase tracking-wider ${rs.labelClass}`}>
                    {ra.role}
                  </span>
                  <p className="text-xs leading-snug text-foreground mt-1">{ra.action}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-foreground">{text}</p>
      )}
    </div>
  );
}
