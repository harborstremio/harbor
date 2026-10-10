import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, MapPin, Trophy } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import {
  requestEsportsJson,
  type EsportsFeed,
  type EsportsGameId,
} from "@/lib/sports/esports-feeds";
import { bo3MatchesUrl, parseBo3Matches, type Bo3Tournament } from "@/lib/sports/esports-bo3-api";
import {
  esportsRowFallbacks,
  rankEsportsEvents,
  type EsportsRowFallback,
  type RankedEsportsEvent,
} from "@/lib/sports/esports-series";
import { esportsEventGameArt } from "@/lib/sports/esports-event-media";
import {
  esportsEventDateRange,
  esportsEventSummaries,
  esportsPrizeLabel,
  type EsportsEventSummary,
} from "./esports-event-model";
import { EsportsImage } from "./esports-image";
import "./esports-events-row.css";

export type { EsportsEventSummary } from "./esports-event-model";

const STRIP_TEAMS = 4;
const gameDef = (id: string) => ESPORTS_GAMES.find((game) => game.id === id);

const CS2_QUERY = { game: "cs2", statuses: ["current", "upcoming"], limit: 100 } as const;

/**
 * The feed already warms this exact URL, so a ten minute view of it is usually free. Tournament
 * money, tier and venue change far more slowly than the board they arrive with.
 */
function useCs2Tournaments(enabled: boolean, refresh: number): Bo3Tournament[] {
  const [rows, setRows] = useState<Bo3Tournament[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void requestEsportsJson(bo3MatchesUrl(CS2_QUERY), 600_000, { signal: controller.signal })
      .then((raw) => parseBo3Matches(raw, CS2_QUERY).tournaments)
      .then((result) => {
        if (!controller.signal.aborted) setRows(result);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled, refresh]);
  return rows;
}

function EventCard({
  entry,
  onOpen,
}: {
  entry: RankedEsportsEvent<EsportsEventSummary>;
  onOpen: (summary: EsportsEventSummary) => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const summary = entry.event;
  const def = gameDef(summary.game);
  const art = esportsEventGameArt(summary.game);
  const chip = entry.tierChip ?? (summary.level === "major" ? "Major" : undefined);
  const where = [summary.location?.city, summary.location?.country].filter(Boolean).join(", ");
  const prize = esportsPrizeLabel(summary.prize?.totalUsd, summary.prizeCurrency, locale);
  const range = esportsEventDateRange(summary.startMs, summary.endMs, locale);
  const extra = summary.teams.length - STRIP_TEAMS;
  return (
    <article className="eev-card" data-live={summary.status === "live" || undefined}>
      <button
        className="eev-card-open"
        onClick={() => onOpen({ ...summary, tierChip: chip })}
        aria-label={`${summary.name} · ${def?.name ?? summary.game}`}
      >
        <span className="eev-card-media">
          <EsportsImage
            src={art.url}
            fallback={art.fallback}
            name={def?.shortName ?? summary.name}
            className="eev-card-art"
          />
          <span className="eev-card-flags">
            {summary.status === "live" && (
              <b className="ea-live">
                <i />
                {t("Live")}
              </b>
            )}
            {chip && <b className="eev-chip eev-chip-tier">{chip}</b>}
          </span>
          <EsportsImage
            src={summary.logo}
            fallback={def?.logo}
            name={summary.name}
            className="eev-card-mark"
          />
        </span>
        <span className="eev-card-body">
          <span className="ea-kicker">{(entry.series?.name ?? def?.name ?? "").toUpperCase()}</span>
          <strong className="eev-card-name">{summary.name}</strong>
          <span className="eev-card-meta">
            {range && (
              <span>
                <CalendarDays size={13} aria-hidden="true" />
                {range}
              </span>
            )}
            {where && (
              <span>
                <MapPin size={13} aria-hidden="true" />
                {where}
              </span>
            )}
            {prize && (
              <span>
                <Trophy size={13} aria-hidden="true" />
                <b>{prize}</b>
              </span>
            )}
          </span>
          {summary.teams.length > 0 && (
            <span className="eev-card-teams">
              {summary.teams.slice(0, STRIP_TEAMS).map((team) => (
                <EsportsImage key={team.id || team.name} src={team.logo} name={team.name} />
              ))}
              {extra > 0 && <small>{`+${extra}`}</small>}
            </span>
          )}
        </span>
      </button>
    </article>
  );
}

function PublisherCard({ fallback }: { fallback: EsportsRowFallback }) {
  const t = useT();
  const def = gameDef(fallback.game);
  const art = esportsEventGameArt(fallback.game);
  if (!def) return null;
  return (
    <article className="eev-card is-fallback">
      <button
        className="eev-card-open"
        onClick={() => openUrl(def.officialUrl)}
        aria-label={`${def.name} · ${t("Official esports site")}`}
      >
        <span className="eev-card-media">
          <EsportsImage
            src={art.url}
            fallback={art.fallback}
            name={def.shortName}
            className="eev-card-art"
          />
          <EsportsImage src={def.logo} name={def.shortName} className="eev-card-mark" />
        </span>
        <span className="eev-card-body">
          <span className="ea-kicker">{def.name.toUpperCase()}</span>
          <strong className="eev-card-name">{t("Official schedule")}</strong>
          <span className="eev-card-note">
            {fallback.reason === "no-events"
              ? t("No matches in the current schedule.")
              : t("Official schedule available")}
          </span>
          <span className="eev-card-action">
            <ExternalLink size={14} aria-hidden="true" />
            {t("Official esports site")}
          </span>
        </span>
      </button>
    </article>
  );
}

/**
 * Top tournaments across the selected titles, ranked by the curated series allowlist. A title that
 * contributed nothing rankable is still named, as a publisher card, rather than silently dropped.
 */
export function EsportsEventsRow({
  feeds,
  games,
  active,
  refresh = 0,
  onOpen,
}: {
  feeds: readonly (EsportsFeed | undefined)[];
  games: readonly EsportsGameId[];
  active: boolean;
  refresh?: number;
  onOpen: (summary: EsportsEventSummary) => void;
}) {
  const t = useT();
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  const tournaments = useCs2Tournaments(active && games.includes("cs2"), refresh);
  const summaries = useMemo(
    () => esportsEventSummaries(feeds, tournaments),
    [feeds, tournaments],
  );
  const ranked = useMemo(
    () => rankEsportsEvents(summaries.filter((summary) => games.includes(summary.game))),
    [summaries, games],
  );
  // Only a title whose provider has actually answered may degrade to a publisher card. Before that
  // the row stays short rather than claiming an empty schedule it has not yet asked about.
  const fallbacks = useMemo(() => {
    const answered = new Set(feeds.filter(Boolean).map((feed) => feed!.game));
    return esportsRowFallbacks(
      ranked,
      games.filter((game) => answered.has(game)),
    );
  }, [feeds, ranked, games]);
  if (!ranked.length && !fallbacks.length) return null;
  return (
    <section className="eev-row-section" aria-label={t("Tournaments")}>
      <div className="ea-board-heading">
        <div>
          <span className="ea-kicker">{t("Upcoming").toUpperCase()}</span>
          <h3>{t("Tournaments")}</h3>
        </div>
      </div>
      <div className="eev-row" ref={ref} {...handlers}>
        {ranked.slice(0, 18).map((entry) => (
          <EventCard key={entry.event.id} entry={entry} onOpen={onOpen} />
        ))}
        {fallbacks.map((fallback) => (
          <PublisherCard key={fallback.game} fallback={fallback} />
        ))}
      </div>
    </section>
  );
}
