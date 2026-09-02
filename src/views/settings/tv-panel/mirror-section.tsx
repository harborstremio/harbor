import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Section } from "../shared";
import { MIRROR_SKIPPED, buildMirrorPlan } from "./mirror";
import { writeTvLayout, writeTvSettings } from "./store";

export function TvMirrorSection({ profileId }: { profileId: string }) {
  const t = useT();
  const { settings } = useSettings();
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 6000);
    return () => window.clearTimeout(id);
  }, [armed]);

  useEffect(() => {
    if (done === 0) return;
    const id = window.setTimeout(() => setDone(0), 3000);
    return () => window.clearTimeout(id);
  }, [done]);

  const apply = () => {
    const plan = buildMirrorPlan(settings);
    writeTvSettings(profileId, plan.settings);
    writeTvLayout(profileId, plan.playerlayout);
    setArmed(false);
    setDone(plan.count);
  };

  const plan = buildMirrorPlan(settings);

  return (
    <Section
      title={t("Start from this computer")}
      subtitle={t("Copy the settings you already tuned here onto the TV in one go. It overwrites the matching TV rows and leaves everything else alone.")}
    >
      <div className="flex flex-col gap-3 rounded-md bg-elevated px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {done > 0 ? (
            <span className="rounded-md bg-accent-soft px-3.5 py-2 text-[12.5px] font-semibold text-accent">
              {t("Copied {n} settings", { n: done })}
            </span>
          ) : armed ? (
            <>
              <button
                type="button"
                onClick={apply}
                className="rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
              >
                {t("Overwrite {n} TV settings", { n: plan.count })}
              </button>
              <button
                type="button"
                onClick={() => setArmed(false)}
                className="rounded-md px-3 py-2 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
              >
                {t("Cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="rounded-md bg-raised px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-90"
            >
              {t("Copy from this computer")}
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-1.5">
          {MIRROR_SKIPPED.map((line) => (
            <li key={line} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-subtle">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
              {t("Not copied: {what}", { what: t(line) })}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
