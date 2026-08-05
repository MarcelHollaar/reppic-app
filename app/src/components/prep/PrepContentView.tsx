"use client";

import { useTranslation } from "react-i18next";

// Herbruikbare weergave van een gespreksvoorbereiding (PrepContent-JSON).
// Gebruikt door /meetings en de gesprek-detailpagina. Secties zonder inhoud
// worden weggelaten — zelfde principe als de prep-mail.

export interface PrepContentShape {
  doel: string;
  informatie_doelen: Array<{ onderwerp: string; waarom: string }>;
  voorgestelde_vragen: string[];
  aandachtspunten: string[];
  deal_samenvatting: string;
}

const SECTION = "tw-text-sm tw-font-semibold tw-text-gray-900 tw-mt-4 tw-mb-1";
const TEXT = "tw-text-sm tw-text-gray-700 tw-leading-relaxed";

const PrepContentView = ({ content }: { content: PrepContentShape }) => {
  const { t } = useTranslation("common");

  return (
    <div>
      <h4 className={SECTION.replace("tw-mt-4", "tw-mt-0")}>
        {t("meetings.goalTitle")}
      </h4>
      <p className={TEXT}>{content.doel}</p>

      {content.informatie_doelen?.length > 0 && (
        <>
          <h4 className={SECTION}>{t("meetings.infoGoalsTitle")}</h4>
          <ul className="tw-list-disc tw-pl-5 tw-space-y-1">
            {content.informatie_doelen.map((goal, i) => (
              <li key={i} className={TEXT}>
                <span className="tw-font-medium">{goal.onderwerp}</span>
                {goal.waarom ? ` — ${goal.waarom}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}

      {content.voorgestelde_vragen?.length > 0 && (
        <>
          <h4 className={SECTION}>{t("meetings.questionsTitle")}</h4>
          <ol className="tw-list-decimal tw-pl-5 tw-space-y-1">
            {content.voorgestelde_vragen.map((q, i) => (
              <li key={i} className={TEXT}>
                {q}
              </li>
            ))}
          </ol>
        </>
      )}

      {content.deal_samenvatting && (
        <>
          <h4 className={SECTION}>{t("meetings.dealTitle")}</h4>
          <p className={TEXT}>{content.deal_samenvatting}</p>
        </>
      )}

      {content.aandachtspunten?.length > 0 && (
        <>
          <h4 className={SECTION}>{t("meetings.attentionTitle")}</h4>
          <ul className="tw-list-disc tw-pl-5 tw-space-y-1">
            {content.aandachtspunten.map((p, i) => (
              <li key={i} className={TEXT}>
                {p}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default PrepContentView;
