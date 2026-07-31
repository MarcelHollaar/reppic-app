"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SelectableCard from "@/components/salescoach/SelectableCard";
import { useTranslation } from "react-i18next";

type ProfileKey =
  | "general_director"
  | "commercial_director"
  | "marketing_manager"
  | "purchasing_manager";

type PhaseKey =
  | "opening"
  | "needs_analysis"
  | "offer"
  | "agreement"
  | "objections";

const PROFILES: { key: ProfileKey; labelKey: string }[] = [
  { key: "general_director", labelKey: "salescoach.profiles.general_director" },
  {
    key: "commercial_director",
    labelKey: "salescoach.profiles.commercial_director",
  },
  {
    key: "marketing_manager",
    labelKey: "salescoach.profiles.marketing_manager",
  },
  {
    key: "purchasing_manager",
    labelKey: "salescoach.profiles.purchasing_manager",
  },
];

const PHASES: { key: PhaseKey; labelKey: string }[] = [
  { key: "opening", labelKey: "salescoach.phases.opening" },
  { key: "needs_analysis", labelKey: "salescoach.phases.needs_analysis" },
  { key: "offer", labelKey: "salescoach.phases.offer" },
  { key: "agreement", labelKey: "salescoach.phases.agreement" },
  { key: "objections", labelKey: "salescoach.phases.objections" },
];

export default function SalesCoachLandingPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [profile, setProfile] = useState<ProfileKey | null>(null);
  const [phase, setPhase] = useState<PhaseKey | null>(null);

  const canStart = useMemo(() => Boolean(profile && phase), [profile, phase]);

  const startTrainer = () => {
    if (!canStart) return;

    const params = new URLSearchParams();

    if (profile) params.set("profile", profile);
    if (phase) params.set("phase", phase);

    router.push(`/salescoach/trainer?${params.toString()}`);
  };

  return (
    <div className="tw-mt-4">
      <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
        <h2 className="tw-text-3xl tw-font-medium tw-mb-5">
          {t("salescoach.title")}
        </h2>
      </div>

      <div className="tw-grid tw-grid-cols-1 xl:tw-grid-cols-2 tw-gap-6">
        <section className="tw-bg-white tw-rounded-2xl tw-p-6 tw-border tw-border-blue-gray-100">
          <h3 className="tw-text-xl tw-font-semibold tw-mb-4">
            {t("salescoach.customerProfile")}
          </h3>
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
            {PROFILES.map((p) => (
              <SelectableCard
                key={p.key}
                label={t(p.labelKey)}
                selected={profile === p.key}
                onClick={() => setProfile(p.key)}
              />
            ))}
          </div>
        </section>

        <section className="tw-bg-white tw-rounded-2xl tw-p-6 tw-border tw-border-blue-gray-100">
          <h3 className="tw-text-xl tw-font-semibold tw-mb-4">
            {t("salescoach.salesPhase")}
          </h3>
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
            {PHASES.map((p) => (
              <SelectableCard
                key={p.key}
                label={t(p.labelKey)}
                selected={phase === p.key}
                onClick={() => setPhase(p.key)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="tw-mt-6 tw-flex tw-justify-end">
        <button
          type="button"
          onClick={startTrainer}
          disabled={!canStart}
          className={`tw-px-6 tw-py-3 tw-rounded-lg tw-font-medium tw-text-white tw-transition tw-duration-150 ${
            canStart
              ? "tw-bg-blue-600 hover:tw-bg-blue-700"
              : "tw-bg-blue-300 tw-cursor-not-allowed"
          }`}
        >
          {t("salescoach.startTrainer")}
        </button>
      </div>
    </div>
  );
}
