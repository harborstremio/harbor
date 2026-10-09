import { useEffect } from "react";
import { useSettings } from "@/lib/settings";
import { HANDOFF_STEPS, type HandoffStepId } from "@/lib/tv-handoff/handoff-protocol";
import type { BpOnboardStepProps } from "../../bp-onboarding-frame";
import { useBpT } from "../../bp-i18n";
import { useBpHandoff } from "../bp-handoff-context";
import { BpHandoffPanel, handoffNote } from "../bp-handoff-panel";
import { BpOnboardAux } from "../bp-onboard-aux";
import {
  BpDecisionAction,
  BpDecisionNote,
  BpDecisionScroll,
  BpTick,
} from "../bp-step-parts";
import { useBpOnboardFacts } from "../use-bp-onboard-facts";

/**
 * Reads the host, never owns it. BpHandoffProvider holds it for the whole flow
 * so the code on screen survives the user pressing Back or Continue.
 */
export function BpStepPhone({ setSatisfied }: BpOnboardStepProps) {
  const t = useBpT();
  const { update } = useSettings();
  const facts = useBpOnboardFacts();
  const handoff = useBpHandoff();

  const complete = handoff.phase === "complete";
  useEffect(() => {
    setSatisfied(complete);
  }, [complete, setSatisfied]);

  const settled: Record<HandoffStepId, string | null> = {
    tmdb: facts.tmdbKey.trim() ? t("TMDB connected") : null,
    stremio: facts.stremioName ? t("Signed in as {name}", { name: facts.stremioName }) : null,
    harbor: facts.harborName ? t("Signed in as {name}", { name: facts.harborName }) : null,
  };
  const waiting: Record<HandoffStepId, string> = {
    tmdb: t("Artwork and rows"),
    stremio: t("Your Stremio library"),
    harbor: t("A Harbor account"),
  };

  return (
    <BpDecisionScroll bottom>
      <div className="flex shrink-0 flex-col gap-[clamp(12px,1.7vh,26px)] pb-[clamp(16px,2.4vh,38px)]">
        <BpHandoffPanel
          phase={handoff.phase}
          qr={handoff.qr}
          codeDisplay={handoff.codeDisplay}
          url={handoff.url}
        />

        <ul className="flex shrink-0 flex-wrap items-center gap-x-[clamp(14px,1.5vw,28px)] gap-y-[clamp(6px,0.8vh,12px)]">
          {HANDOFF_STEPS.map((s) => (
            <li
              key={s}
              className="flex items-center gap-[clamp(7px,0.7vw,13px)] text-[clamp(11px,1.5vh,17px)] font-semibold"
            >
              <BpTick on={settled[s] !== null} />
              <span className={settled[s] ? "text-ink" : "text-ink-subtle"}>
                {settled[s] ?? waiting[s]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <BpDecisionNote
        text={handoffNote(t, handoff.phase)}
        alert={handoff.phase === "stalled" || handoff.phase === "noAddress"}
      />

      {handoff.phase === "servingOff" && (
        <BpOnboardAux>
          <BpDecisionAction
            label={t("Turn on phone setup")}
            onSelect={() => update({ serveWebUi: true, remoteControlEnabled: true })}
          />
        </BpOnboardAux>
      )}

      {handoff.phase !== "complete" && handoff.phase !== "servingOff" && (
        <BpOnboardAux>
          <BpDecisionAction label={t("Show a new code")} tone="quiet" onSelect={handoff.restart} />
        </BpOnboardAux>
      )}
    </BpDecisionScroll>
  );
}
