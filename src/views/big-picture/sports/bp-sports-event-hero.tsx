import { useState } from "react";
import { SFX } from "@/lib/sfx";
import type { SportsSide } from "@/lib/sports/espn-types";
import {
  BP_ACTION_HINT,
  BP_ACTION_TRACK,
  BpDetailActions,
  BpSecondaryAction,
} from "../bp-detail-actions";
import { useBpT } from "../bp-i18n";
import type { BpDetailAction } from "../use-bp-detail-actions";
import { BpSportsLeagueMark, BpSportsMark } from "./bp-sports-mark";
import { BpSportsWhoPanel } from "./bp-sports-who-panel";
import { BP_WHO_LIFT } from "./bp-sports-who-parts";
import { bpSportsWhoSubject, type BpSportsWhoSubject } from "./bp-sports-who-subject";
import type { BpSportsEventData } from "./use-bp-sports-event";

const MARK = "clamp(96px, 12.6vh, 168px)";

const MEASURE = "w-full max-w-[min(54vw,880px)]";

const SIDE =
  "flex min-w-0 flex-1 basis-0 flex-col gap-[clamp(9px,1.1vh,17px)] rounded-[var(--bp-r-md)] p-[clamp(6px,0.8vh,12px)] transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none data-[bp-focus=true]:bg-[var(--bp-focus-face)]";

const NAME =
  "line-clamp-2 text-[calc(clamp(22px,3.1vh,38px)*var(--bp-up,1))] font-semibold leading-[1.14] tracking-[-0.012em] text-ink";

const SUB =
  "text-[calc(clamp(14px,1.9vh,22px)*var(--bp-up,1))] font-semibold tabular-nums text-ink-subtle";

const SCORE =
  "font-display text-[calc(clamp(72px,9.2vh,150px)*var(--bp-up,1))] font-semibold leading-[0.9] tracking-[-0.035em] tabular-nums text-ink";

const VERSUS =
  "font-display text-[calc(clamp(24px,3.2vh,42px)*var(--bp-up,1))] font-semibold uppercase leading-none tracking-[0.16em] text-ink-subtle";

const CLOCK =
  "max-w-[clamp(150px,16vw,300px)] text-center text-[calc(clamp(15px,2.05vh,25px)*var(--bp-up,1))] font-semibold leading-[1.3] text-ink-muted";

const PILL =
  "inline-flex items-center rounded-[var(--bp-r-xs)] px-[clamp(10px,0.9vw,18px)] py-[clamp(5px,0.6vh,10px)] text-[calc(clamp(12px,1.62vh,19px)*var(--bp-up,1))] font-bold uppercase tracking-[0.12em]";

const NOTE =
  "mt-[clamp(10px,1.2vh,18px)] text-[calc(clamp(14px,1.85vh,22px)*var(--bp-up,1))] font-medium leading-[1.5] text-ink-subtle";

function BpEventSide({
  side,
  art,
  fallback,
  sport,
  bare,
  rankLabel,
  end,
  subject,
  onOpen,
}: {
  side: SportsSide;
  art: string;
  fallback: string;
  sport: string;
  bare: boolean;
  rankLabel: string;
  end: boolean;
  subject: BpSportsWhoSubject | null;
  onOpen: (next: BpSportsWhoSubject) => void;
}) {
  const t = useBpT();
  const box = `${SIDE} ${end ? "items-end text-end" : "items-start text-start"}`;
  const body = (
    <>
      <BpSportsMark
        side={{ ...side, logo: art || side.logo }}
        fallback={fallback}
        sport={sport}
        size={MARK}
        tone={bare ? "bare" : "plate"}
        eager
      />
      <span className={NAME}>{side.name}</span>
      {(rankLabel || side.record) && (
        <span className={SUB}>{[rankLabel, side.record].filter(Boolean).join(" · ")}</span>
      )}
    </>
  );

  if (subject === null) return <div className={box}>{body}</div>;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={subject.key}
      aria-label={t("Open {name}", { name: side.name })}
      style={BP_WHO_LIFT}
      onClick={() => {
        SFX.open();
        onOpen(subject);
      }}
      className={box}
    >
      {body}
    </button>
  );
}

function BpEventTools({ actions }: { actions: BpDetailAction[] }) {
  const [hint, setHint] = useState("");
  if (actions.length === 0) return null;
  return (
    <section
      data-bp-row
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHint("");
      }}
      style={{ containIntrinsicSize: "auto 90px" }}
      className="mt-[clamp(14px,1.9vh,30px)]"
    >
      <div data-bp-scroll-x className={BP_ACTION_TRACK}>
        {actions.map((action, i) => (
          <BpSecondaryAction key={action.key} action={action} onHint={setHint} seed={i === 0} />
        ))}
      </div>
      <p data-bp-action-hint className={BP_ACTION_HINT}>
        {hint || " "}
      </p>
    </section>
  );
}

export function BpSportsEventHero({
  data,
  playLabel,
  onPlay,
  actions,
}: {
  data: BpSportsEventData;
  playLabel: string;
  onPlay: () => void;
  actions: BpDetailAction[];
}) {
  const t = useBpT();
  const [whoStack, setWhoStack] = useState<BpSportsWhoSubject[]>([]);
  const who = whoStack[whoStack.length - 1] ?? null;
  const { game, leagueLabel, when, sides, scores } = data;
  const whoOf = (key: "home" | "away") =>
    bpSportsWhoSubject({
      side: game[key],
      art: key === "home" ? data.homeArt : data.awayArt,
      league: data.league,
      leagueTag: game.league,
      group: data.group,
      individual: data.individual,
      source: game.source,
      profile: key === "home" ? data.detail?.homeProfile : data.detail?.awayProfile,
    });
  const live = game.state === "in";
  const finished = game.state === "post";
  const held = data.detail !== null;
  const saved = held && ((data.failed && data.summary) || game.savedAt !== undefined);
  const provenance =
    game.source === "official-boxing"
      ? t(
          "Schedule published by the event promoter. Visit the official fight card for the latest lineup and broadcast details.",
        )
      : game.source === "official-one"
        ? t(
            "Schedule from ONE Championship. Visit the official event page for the announced fight card.",
          )
        : game.source === "thesportsdb-hub"
          ? t(
              "Schedule from TheSportsDB. Live scores and detailed statistics are not supplied by this feed.",
            )
          : "";
  const unavailable = data.failed && data.summary && !held && !data.loading && provenance === "";
  const title =
    game.context?.name || (sides ? "" : game.home.name || game.away.name || leagueLabel);
  const facts = [
    game.context?.round,
    !sides && game.state !== "pre" ? game.detail : "",
    game.context?.venue,
    when,
    (game.broadcasts ?? []).join(", "),
  ]
    .filter(Boolean)
    .map((value) => String(value));

  return (
    <>
      <div className="relative flex min-h-[clamp(420px,58vh,760px)] flex-col justify-end px-[var(--bp-gutter)] pb-[clamp(16px,2.2vh,38px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]">
        <div className="flex items-center gap-[clamp(10px,1vw,20px)]">
          <BpSportsLeagueMark league={data.league} size="clamp(36px, 4.4vh, 60px)" />
          <span className="text-[calc(clamp(14px,1.85vh,22px)*var(--bp-up,1))] font-bold uppercase tracking-[0.14em] text-ink-subtle">
            {leagueLabel}
          </span>
          {live && (
            <span className={`${PILL} bg-[var(--bp-live)] text-[var(--bp-void)]`}>
              {t("Live now")}
            </span>
          )}
          {finished && (
            <span
              className={`${PILL} bg-[var(--bp-void)]/70 text-ink ring-1 ring-[var(--bp-edge-2)]`}
            >
              {t("Final")}
            </span>
          )}
          {saved && (
            <span
              className={`${PILL} bg-[var(--bp-void)]/70 text-ink-subtle ring-1 ring-[var(--bp-edge-2)]`}
            >
              {t("Saved")}
            </span>
          )}
        </div>

        {title !== "" && (
          <h1
            className={`mt-[clamp(10px,1.2vh,20px)] line-clamp-2 font-display text-[calc(clamp(30px,4.2vh,56px)*var(--bp-up,1))] font-semibold leading-[1.06] tracking-[-0.025em] text-ink ${MEASURE}`}
          >
            {title}
          </h1>
        )}

        {sides && (
          <div
            className={`mt-[clamp(18px,2.2vh,38px)] flex items-start gap-[clamp(14px,1.6vw,40px)] ${MEASURE}`}
          >
            <BpEventSide
              side={game.away}
              art={data.awayArt}
              fallback={data.league?.logo ?? ""}
              sport={data.group}
              bare={data.individual}
              rankLabel={game.away.rank ? `#${game.away.rank}` : ""}
              end={false}
              subject={whoOf("away")}
              onOpen={(next) => setWhoStack([next])}
            />
            <div className="flex min-w-0 flex-col items-center gap-[clamp(9px,1.1vh,17px)] px-[clamp(4px,0.6vw,16px)]">
              <span
                style={{ minHeight: MARK }}
                className={`flex items-center ${scores ? SCORE : VERSUS}`}
              >
                {scores ? `${game.away.score || "0"} : ${game.home.score || "0"}` : t("vs")}
              </span>
              {game.detail && <span className={CLOCK}>{game.detail}</span>}
            </div>
            <BpEventSide
              side={game.home}
              art={data.homeArt}
              fallback={data.league?.logo ?? ""}
              sport={data.group}
              bare={data.individual}
              rankLabel={game.home.rank ? `#${game.home.rank}` : ""}
              end
              subject={whoOf("home")}
              onOpen={(next) => setWhoStack([next])}
            />
          </div>
        )}

        {facts.length > 0 && (
          <div
            data-bp-hero-meta
            className={`mt-[clamp(14px,1.7vh,26px)] flex flex-wrap items-center gap-x-[18px] gap-y-[7px] text-[clamp(13.4px,1.45vh,17px)] font-semibold tracking-[0.015em] text-ink-subtle ${MEASURE}`}
          >
            {facts.map((fact) => (
              <span key={fact} className="flex items-center">
                {fact}
              </span>
            ))}
          </div>
        )}

        {finished ? (
          <BpEventTools actions={actions} />
        ) : (
          <div className="mt-[clamp(14px,1.9vh,30px)]">
            <BpDetailActions playLabel={playLabel} onPlay={onPlay} actions={actions} progress={0} />
          </div>
        )}

        {data.loading && !data.detail && data.summary && (
          <p className={`${NOTE} ${MEASURE}`}>{t("Loading match details...")}</p>
        )}
        {saved && <p className={`${NOTE} ${MEASURE}`}>{t("Showing saved match details.")}</p>}
        {provenance !== "" && !held && <p className={`${NOTE} ${MEASURE}`}>{provenance}</p>}
        {unavailable && (
          <p className={`${NOTE} ${MEASURE}`}>
            {t("Match details are not available right now. The scoreboard above is still live.")}
          </p>
        )}
      </div>

      {who !== null && (
        <BpSportsWhoPanel
          key={who.key}
          subject={who}
          leagueLabel={leagueLabel}
          onClose={() => setWhoStack([])}
          onBack={() => setWhoStack((held) => held.slice(0, -1))}
          onSubject={(next) => setWhoStack((held) => [...held, next])}
        />
      )}
    </>
  );
}
