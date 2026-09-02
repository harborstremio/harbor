import { useEffect } from "react";
import { Palette, Users } from "lucide-react";
import type { BpOnboardStepProps } from "../../bp-onboarding-frame";
import { useBpT } from "../../bp-i18n";
import { BpHarborSync } from "../bp-harbor-sync";
import { BpDecisionNote, BpDecisionScroll, BpStepConfirmed } from "../bp-step-parts";
import { useBpOnboardFacts } from "../use-bp-onboard-facts";

/**
 * The only step with no TV typing path, on purpose. The ecosystem session has a
 * five year sliding TTL and no revoke route, so relaying that password over a
 * cleartext LAN surface is worse than not offering it here at all. The frame
 * parks the ring on Later for this screen; the phone screen is the way in.
 */
export function BpStepHarbor({ setSatisfied }: BpOnboardStepProps) {
  const t = useBpT();
  const facts = useBpOnboardFacts();
  const linked = facts.harborName !== null;

  useEffect(() => {
    setSatisfied(linked);
  }, [linked, setSatisfied]);

  if (linked) {
    return (
      <BpDecisionScroll>
        <BpStepConfirmed
          title={t("Signed in as {name}", { name: facts.harborName ?? "" })}
          detail={t("Themes, lists and friends follow this account.")}
        />
      </BpDecisionScroll>
    );
  }

  return (
    <BpDecisionScroll>
      <BpHarborSync />
      <div className="flex shrink-0 flex-wrap gap-[clamp(10px,1vw,18px)]">
        <Note
          icon={<Palette size={24} strokeWidth={2} />}
          title={t("Themes and lists")}
          body={t("Publish a theme, share a list, keep both when you reinstall.")}
        />
        <Note
          icon={<Users size={24} strokeWidth={2} />}
          title={t("Friends")}
          body={t("See what the people you follow are watching right now.")}
        />
      </div>
      <BpDecisionNote
        text={t(
          "There is no safe way to type a password for this on a TV, so this one only happens on your phone. Settings has it whenever you want it.",
        )}
      />
    </BpDecisionScroll>
  );
}

function Note({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-w-[min(100%,28ch)] flex-1 items-start gap-[clamp(11px,1.1vw,20px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(15px,1.4vw,28px)] py-[clamp(13px,1.7vh,24px)]">
      <span className="shrink-0 text-ink-subtle">{icon}</span>
      <span className="flex min-w-0 flex-col gap-[clamp(2px,0.35vh,6px)]">
        <span className="text-[clamp(14px,1.95vh,23px)] font-semibold text-ink">{title}</span>
        <span className="text-[clamp(12.5px,1.7vh,19px)] leading-relaxed text-ink-subtle">
          {body}
        </span>
      </span>
    </div>
  );
}
