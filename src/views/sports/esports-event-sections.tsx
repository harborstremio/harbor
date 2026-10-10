import { useMemo, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useDragScroll } from "@/lib/use-drag-scroll";
import type { EsportsMatch } from "@/lib/sports/esports-feeds";
import type { LiquipediaBracket, LiquipediaBracketMatch } from "@/lib/sports/esports-liquipedia";
import type { EsportsEventDetail } from "./use-esports-event";

const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA");

/** Contractual, not decorative: the licence travels with the text on every surface that shows it.
 *  The page link itself sits in Sources, where it is a full size control. */
function LiquipediaCreditLine({ detail }: { detail: EsportsEventDetail }) {
  const t = useT();
  const credit = detail.credit;
  if (!credit) return null;
  return (
    <small className="eev-credit">{`${t("Source")}: ${credit.source} (${credit.licence})`}</small>
  );
}

function BracketMatch({ match }: { match: LiquipediaBracketMatch }) {
  return (
    <article className="eev-bracket-match">
      {match.opponents.map((side, index) => (
        <span className="eev-bracket-side" key={index} data-winner={side.winner || undefined}>
          <strong>{side.name || "TBD"}</strong>
          <b dir="ltr">{side.scoreRaw ?? side.score ?? ""}</b>
        </span>
      ))}
      {match.maps.length > 0 && (
        <span className="eev-bracket-maps">
          {match.maps.map((map, index) => (
            <small key={index}>
              {map.name}
              {map.scores && <b dir="ltr">{`${map.scores[0]} : ${map.scores[1]}`}</b>}
            </small>
          ))}
        </span>
      )}
    </article>
  );
}

function Bracket({ bracket }: { bracket: LiquipediaBracket }) {
  const t = useT();
  return (
    <div className="eev-bracket">
      {bracket.rounds.map((round) => (
        <div className="eev-bracket-round" key={round.round}>
          <h4>{`${t("Round")} ${round.round}`}</h4>
          {round.matches
            .filter((match) => match.resolved)
            .map((match) => (
              <BracketMatch key={match.key} match={match} />
            ))}
        </div>
      ))}
    </div>
  );
}

function Rail({ label, children }: { label: string; children: ReactNode }) {
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  return (
    <div className="eev-rail" ref={ref} {...handlers} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * The stage is the unit of rendering, and each stage shows only what its source actually holds. A
 * bracket is drawn from resolved Liquipedia match rows alone; the day grouped list is the universal
 * presenter behind it, and no empty tree is ever drawn from stub templates.
 */
export function EsportsEventStages({
  matches,
  detail,
  renderMatch,
}: {
  matches: EsportsMatch[];
  detail: EsportsEventDetail;
  renderMatch: (match: EsportsMatch) => ReactNode;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const [stage, setStage] = useState("");
  const [phase, setPhase] = useState<"all" | "upcoming" | "completed">("all");
  const stages = useMemo(
    () => [
      ...new Set(
        matches
          .map((match) => match.event.stage)
          .filter((value): value is string => !!value?.trim()),
      ),
    ].slice(0, 12),
    [matches],
  );
  const shown = matches
    .filter((match) => !stage || match.event.stage === stage)
    .filter((match) =>
      phase === "all"
        ? true
        : phase === "completed"
          ? match.state === "recent"
          : match.state !== "recent",
    )
    .sort((a, b) => a.startMs - b.startMs);
  const days: { key: string; label: string; matches: EsportsMatch[] }[] = [];
  for (const match of shown) {
    const key = dayKey(match.startMs);
    const last = days.at(-1);
    if (last?.key === key) last.matches.push(match);
    else
      days.push({
        key,
        label: new Date(match.startMs).toLocaleDateString(locale, {
          weekday: "short",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        matches: [match],
      });
  }
  const partial =
    detail.bracketGap === "unsupported-wiki" || detail.bracketGap === "empty-match-stubs";
  if (!matches.length && !detail.brackets.length) return null;
  return (
    <>
      {detail.brackets.map((bracket, index) => (
        <section className="eev-section" key={bracket.id ?? index}>
          <h3>{t("Results")}</h3>
          <Bracket bracket={bracket} />
          <LiquipediaCreditLine detail={detail} />
        </section>
      ))}
      {matches.length > 0 && (
        <section className="eev-section">
          <h3>{t("Matches")}</h3>
          {partial && (
            <p className="eev-empty">
              {t("Match list only; bracket structure is not available for this title.")}
            </p>
          )}
          {stages.length > 1 && (
            <Rail label={t("Format")}>
              <button aria-pressed={!stage} onClick={() => setStage("")}>
                {t("All")}
              </button>
              {stages.map((name) => (
                <button key={name} aria-pressed={stage === name} onClick={() => setStage(name)}>
                  {name}
                </button>
              ))}
            </Rail>
          )}
          <Rail label={t("Schedule")}>
            {(
              [
                ["all", "All"],
                ["upcoming", "Upcoming"],
                ["completed", "Completed"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} aria-pressed={phase === key} onClick={() => setPhase(key)}>
                {t(label)}
              </button>
            ))}
          </Rail>
          {days.length > 0 ? (
            days.map((day) => (
              <div className="eev-day" key={day.key}>
                <h4>{day.label}</h4>
                <div className="eev-matches">{day.matches.map(renderMatch)}</div>
              </div>
            ))
          ) : (
            <p className="eev-empty">{t("No matches in the current schedule.")}</p>
          )}
        </section>
      )}
    </>
  );
}

/** Video, then the map pool. Both are absent more often than present; absent renders nothing. */
export function EsportsEventMedia({ detail }: { detail: EsportsEventDetail }) {
  const t = useT();
  if (!detail.videos.length && !detail.maps.length) return null;
  return (
    <section className="eev-section">
      <h3>{t("Media")}</h3>
      {detail.videos.length > 0 && (
        <Rail label={t("Videos")}>
          {detail.videos.slice(0, 12).map((video) => (
            <button className="eev-video" key={video.id} onClick={() => openUrl(video.url)}>
              <span className="eev-video-thumb">
                <img
                  src={video.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onError={(event) => (event.currentTarget.hidden = true)}
                />
                <Play size={18} fill="currentColor" aria-hidden="true" />
              </span>
              <strong>{video.title}</strong>
              <small>{video.channel}</small>
            </button>
          ))}
        </Rail>
      )}
      {detail.maps.length > 0 && (
        <Rail label={t("Maps")}>
          {detail.maps.map((map) => (
            <span className="eev-map" key={map.id}>
              <img
                src={map.url}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={(event) => {
                  const next = map.fallback;
                  if (next && !event.currentTarget.src.endsWith(next))
                    event.currentTarget.src = next;
                  else event.currentTarget.hidden = true;
                }}
              />
              <strong>{map.name}</strong>
              {map.referenceOnly && map.sourceLabel && <small>{map.sourceLabel}</small>}
            </span>
          ))}
        </Rail>
      )}
    </section>
  );
}

/** Placement money, the one field only Liquipedia publishes keylessly on every wiki. */
export function EsportsEventPrizes({ detail }: { detail: EsportsEventDetail }) {
  const t = useT();
  const locale = useUiLanguage();
  const slots = detail.prizes.filter((slot) => slot.usd !== undefined || slot.teams.length > 0);
  if (!slots.length) return null;
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return (
    <section className="eev-section">
      <h3>{t("Prize pool")}</h3>
      <ol className="eev-prizes">
        {slots.slice(0, 16).map((slot, index) => (
          <li key={`${slot.place}-${index}`} data-podium={(slot.rank ?? 9) <= 3 || undefined}>
            <span className="eev-prize-place" dir="ltr">
              {slot.place}
            </span>
            <span className="eev-prize-teams">{slot.teams.join(", ")}</span>
            {slot.usd !== undefined && (
              <b className="eev-prize-money">{money.format(slot.usd)}</b>
            )}
          </li>
        ))}
      </ol>
      <LiquipediaCreditLine detail={detail} />
    </section>
  );
}
