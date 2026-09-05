import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useSettings } from "@/lib/settings";
import { Section } from "../shared";
import { SButton } from "../ui";
import { MIRROR_SKIPPED, buildMirrorPlan } from "./mirror";
import { writeTvLayout, writeTvSettings } from "./store";

export function TvMirrorSection({ profileId }: { profileId: string }) {
  const t = useT();
  const { settings } = useSettings();
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(0);
  const rowRef = useRef<HTMLDivElement | null>(null);

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

  const disarm = () => {
    const back = rowRef.current?.querySelector("button");
    if (back && navOwnsFocus(document.activeElement as HTMLElement | null)) tvFocus(back);
    setArmed(false);
  };

  const plan = buildMirrorPlan(settings);

  return (
    <Section
      title={t("Start from this computer")}
      subtitle={t("Copy the settings you already tuned here onto the TV in one go. It overwrites the matching TV rows and leaves everything else alone.")}
    >
      <div className="flex flex-col gap-4 py-1">
        <div ref={rowRef} className="flex flex-wrap items-center gap-2.5">
          <SButton
            variant={armed ? "primary" : "secondary"}
            onClick={armed ? apply : () => setArmed(true)}
          >
            {armed
              ? t("Overwrite {n} TV settings", { n: plan.count })
              : t("Copy from this computer")}
          </SButton>
          {armed && <SButton onClick={disarm}>{t("Cancel")}</SButton>}
          {done > 0 && (
            <span className="inline-flex h-11 shrink-0 items-center rounded-[8px] bg-accent-soft px-4 text-[15px] font-semibold text-accent">
              {t("Copied {n} settings", { n: done })}
            </span>
          )}
        </div>
        <ul className="flex max-w-[70ch] flex-col gap-1.5">
          {MIRROR_SKIPPED.map((line) => (
            <li
              key={line}
              className="flex gap-2.5 text-[15.5px] font-normal leading-[22px] text-ink-subtle"
            >
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
              {t("Not copied: {what}", { what: t(line) })}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
