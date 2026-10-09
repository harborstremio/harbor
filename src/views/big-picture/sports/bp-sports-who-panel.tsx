import { useEffect, useRef } from "react";
import { ArrowUpRight, ShieldHalf, UserRound, X } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { openUrl } from "@/lib/window";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { bpFirstVisible } from "../bp-visible";
import { currentBpFocus, setBpFocus } from "../use-bp-focus";
import { BpSportsLeagueMark } from "./bp-sports-mark";
import { useBpSportsWhoAthleteView } from "./bp-sports-who-athlete";
import {
  BP_WHO_BODY,
  BP_WHO_EYEBROW,
  BP_WHO_FLUSH,
  BP_WHO_LEAD,
  BP_WHO_NAME,
  BP_WHO_NOTE,
  BpSportsWhoArt,
  BpSportsWhoChip,
  BpSportsWhoFacts,
  BpSportsWhoFigures,
} from "./bp-sports-who-parts";
import type { BpSportsWhoSubject } from "./bp-sports-who-subject";
import { useBpSportsWhoTeamView } from "./bp-sports-who-team";
import { bpSportsWhoPlayerSubject } from "./bp-sports-who-subject";

const STAGE =
  "fixed inset-0 z-[72] flex bg-[color-mix(in_oklab,var(--bp-void)_94%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]";

const COPY =
  "relative z-[1] flex min-w-0 flex-1 flex-col gap-[clamp(9px,1.2vh,19px)] overflow-y-auto ps-[var(--bp-gutter)] pe-[clamp(18px,1.8vw,40px)] pt-[var(--bp-page-top)] pb-[clamp(26px,3.2vh,54px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]";

const ART = "relative m-0 w-[clamp(232px,27vw,520px)] shrink-0 overflow-hidden";

const ACTIONS =
  "flex shrink-0 gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function BpSportsWhoPanel({
  subject,
  leagueLabel,
  onClose,
  onBack,
  onSubject,
}: {
  subject: BpSportsWhoSubject;
  leagueLabel: string;
  onClose: () => void;
  onBack?: () => void;
  onSubject?: (next: BpSportsWhoSubject) => void;
}) {
  const t = useBpT();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const openPlayer =
    onSubject === undefined || subject.kind !== "team"
      ? undefined
      : (player: { id: string; name: string; image?: string; source: "espn" | "thesportsdb" }) => {
          const next = bpSportsWhoPlayerSubject(player, subject.league, subject.identity.league);
          if (next) onSubject(next);
        };
  const team = useBpSportsWhoTeamView(subject.kind === "team" ? subject : null, openPlayer);
  const athlete = useBpSportsWhoAthleteView(subject.kind === "athlete" ? subject : null);
  const view = subject.kind === "team" ? team : athlete;

  useEffect(() => {
    const previous = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    const frame = window.requestAnimationFrame(() => {
      const first = stageRef.current?.querySelector<HTMLElement>("[data-bp-focusable]");
      if (first) setBpFocus(first, { silent: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  const close = useRef(onClose);
  useEffect(() => {
    close.current = onBack ?? onClose;
  });

  useEffect(
    () =>
      pushBpBack(() => {
        close.current();
        return true;
      }),
    [],
  );

  const eyebrow = [view.eyebrow, leagueLabel].filter((part) => part !== "").join(" · ");
  const link = view.link;

  return (
    <div ref={stageRef} role="dialog" aria-label={subject.name} data-bp-dialog className={STAGE}>
      <div data-bp-scroll-y className={COPY}>
        <div className="flex items-center gap-[clamp(9px,0.9vw,18px)]">
          <BpSportsLeagueMark league={subject.league} size="clamp(30px, 3.6vh, 50px)" />
          <span className={`${BP_WHO_EYEBROW} truncate`}>{eyebrow}</span>
        </div>

        <h2 className={`${BP_WHO_NAME} line-clamp-2`}>{subject.name}</h2>

        {view.lead !== "" && <p className={`${BP_WHO_LEAD} line-clamp-2`}>{view.lead}</p>}

        <BpSportsWhoFigures figures={view.figures} />

        <BpSportsWhoFacts facts={view.facts} />

        {view.body !== "" && <p className={`${BP_WHO_BODY} line-clamp-3`}>{view.body}</p>}

        {view.loading ? (
          <p role="status" className={BP_WHO_NOTE}>
            {t("Loading...")}
          </p>
        ) : (
          view.note !== "" && (
            <p role="status" className={BP_WHO_NOTE}>
              {view.note}
            </p>
          )
        )}

        {view.extra}

        <div className="mt-auto pt-[clamp(10px,1.3vh,22px)]">
          <div
            data-bp-row
            data-bp-row-key="bp-sports-who-actions"
            data-bp-scroll-x
            style={{ ...BP_WHO_FLUSH, containIntrinsicSize: "auto 96px" }}
            className={ACTIONS}
          >
            <BpSportsWhoChip
              label={t("Close")}
              restoreKey="bp-sports-who-close"
              icon={<X size={20} strokeWidth={2.3} className="shrink-0" />}
              onPress={() => {
                SFX.close();
                onClose();
              }}
            />
            {link !== null && (
              <BpSportsWhoChip
                label={link.label}
                restoreKey="bp-sports-who-link"
                icon={<ArrowUpRight size={20} strokeWidth={2.3} className="shrink-0" />}
                onPress={() => void openUrl(link.url)}
              />
            )}
          </div>
        </div>
      </div>

      <figure className={ART}>
        <BpSportsWhoArt
          src={view.art}
          fit={view.fit}
          fallback={
            subject.kind === "team" ? (
              <ShieldHalf className="h-[clamp(64px,9vh,128px)] w-[clamp(64px,9vh,128px)] text-ink-subtle" />
            ) : (
              <UserRound className="h-[clamp(64px,9vh,128px)] w-[clamp(64px,9vh,128px)] text-ink-subtle" />
            )
          }
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--bp-scrim-side)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%]"
          style={{ background: "var(--bp-scrim-up)" }}
        />
      </figure>
    </div>
  );
}
