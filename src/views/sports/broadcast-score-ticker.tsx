import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Pause, Play } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import { currentEsportsMatches, type EsportsMatch } from "@/lib/sports/esports-feeds";
import { esportsExternalUrl } from "@/lib/sports/esports-streams";
import { useEsports } from "./use-esports";
import { EsportsGameLogo, EsportsImage } from "./esports-image";
import "./broadcast-score-ticker.css";
import "./esports-hub.css";
const MatchDetails = lazy(() =>
  import("./esports-match").then((m) => ({ default: m.EsportsMatchView })),
);

export function BroadcastScoreTicker({
  streamUrl,
  onWatch,
}: {
  streamUrl: string;
  onWatch: (stream: import("@/lib/sports/esports-streams").EsportsStream) => void;
}) {
  const { feeds, now } = useEsports("all", true, 0, { profiles: false });
  const current = esportsExternalUrl(streamUrl)?.replace(/\/$/, "").toLowerCase();
  const matches = currentEsportsMatches(
    Object.values(feeds).flatMap((feed) =>
      feed?.status === "ready" && now - feed.fetchedAt < 120_000 ? feed.matches : [],
    ),
    now,
  )
    .filter(
      (match) =>
        !match.streams.some(
          (stream) => esportsExternalUrl(stream.url)?.replace(/\/$/, "").toLowerCase() === current,
        ),
    )
    .sort((a, b) => a.game.localeCompare(b.game) || a.id.localeCompare(b.id));
  const games = ["dota2", "cs2", "lol", "valorant", "rocketleague"];
  const rank = { live: 0, upcoming: 1, recent: 2 };
  const buckets = games.map((game) =>
    matches
      .filter((match) => match.game === game)
      .sort(
        (a, b) =>
          rank[a.state] - rank[b.state] ||
          (a.state === "recent" ? b.startMs - a.startMs : a.startMs - b.startMs),
      )
      .slice(0, 6),
  );
  const mixed = Array.from({ length: 6 }, (_, index) =>
    buckets.flatMap((bucket) => (bucket[index] ? [bucket[index]] : [])),
  ).flat();
  return <ScoreTicker matches={mixed} onWatch={onWatch} />;
}

export function ScoreTicker({
  matches,
  onWatch,
}: {
  matches: EsportsMatch[];
  onWatch?: (stream: import("@/lib/sports/esports-streams").EsportsStream) => void;
}) {
  const t = useT();
  const [paused, setPaused] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const resumeAt = useRef(0);
  const position = useRef(0);
  const [selected, setSelected] = useState<EsportsMatch | null>(null);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [matches.length > 0]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0;
    const tick = (time: number) => {
      const elapsed = last ? Math.min(time - last, 50) : 0;
      last = time;
      if (
        !paused &&
        !selected &&
        !drag.current &&
        !reduce.matches &&
        time >= resumeAt.current &&
        document.visibilityState === "visible"
      ) {
        const half = node.scrollWidth / 2;
        // Preserve subpixel progress: scrollLeft rounds small per-frame increments.
        position.current += elapsed * 0.035;
        if (half >= node.clientWidth && position.current >= half) position.current -= half;
        node.scrollLeft = position.current;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        node.scrollLeft += event.deltaY;
        position.current = node.scrollLeft;
        resumeAt.current = performance.now() + 1500;
      }
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("wheel", wheel);
    };
  }, [paused, selected, matches.length > 0]);
  if (!matches.length && !selected) return null;
  const items = matches.slice(0, 24);
  const repeats = Math.max(1, Math.ceil(width / Math.max(260, items.length * 260)));
  const loopItems = Array.from({ length: repeats }, () => items).flat();
  const group = (duplicate: boolean) => (
    <div className="broadcast-score-group" aria-hidden={duplicate || undefined}>
      {loopItems.map((match, index) => {
        const game = ESPORTS_GAMES.find((game) => game.id === match.game);
        return (
          <button
            type="button"
            onClick={() => setSelected(match)}
            tabIndex={duplicate || index >= items.length ? -1 : 0}
            className="broadcast-score-item"
            key={`${match.game}:${match.id}:${index}`}
            title={`${game?.name} · ${match.event.name}`}
          >
            {game && (
              <span className="broadcast-score-game">
                <EsportsGameLogo game={game} />
                <span>{game.shortName}</span>
              </span>
            )}
            <span className="broadcast-score-team">
              <EsportsImage src={match.teams[0].logo} name={match.teams[0].name} />
              <span>{match.teams[0].code || match.teams[0].name}</span>
            </span>
            <b className="broadcast-score-value" dir="ltr">
              {match.state === "upcoming"
                ? new Date(match.startMs).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : `${match.teams[0].score ?? "—"} : ${match.teams[1].score ?? "—"}`}
            </b>
            <span className="broadcast-score-team">
              <EsportsImage src={match.teams[1].logo} name={match.teams[1].name} />
              <span>{match.teams[1].code || match.teams[1].name}</span>
            </span>
            <span className="broadcast-score-status" data-state={match.state}>
              {match.state === "live" && <i />}
              {t(
                match.state === "live"
                  ? "Live now"
                  : match.state === "upcoming"
                    ? "Upcoming"
                    : "Final",
              )}
            </span>
            {match.game === "dota2" && match.state !== "upcoming" && <small>{t("Kills")}</small>}
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      <section
        className="broadcast-score-ticker"
        aria-label={t("Esports")}
        data-paused={paused || !!selected}
      >
        <span className="broadcast-score-live">
          <i />
          {t("Esports")}
        </span>
        <div
          ref={viewport}
          className="broadcast-score-viewport"
          tabIndex={0}
          dir="ltr"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            suppressClick.current = false;
            drag.current = {
              x: event.clientX,
              scroll: event.currentTarget.scrollLeft,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            const delta = event.clientX - start.x;
            if (Math.abs(delta) > 5) {
              start.moved = true;
              suppressClick.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }
            if (start.moved) event.currentTarget.scrollLeft = start.scroll - delta;
          }}
          onPointerUp={(event) => {
            drag.current = null;
            position.current = event.currentTarget.scrollLeft;
            resumeAt.current = performance.now() + 700;
          }}
          onPointerCancel={(event) => {
            drag.current = null;
            position.current = event.currentTarget.scrollLeft;
            resumeAt.current = performance.now() + 700;
          }}
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              resumeAt.current = performance.now() + 2000;
              const node = event.currentTarget;
              requestAnimationFrame(() => {
                position.current = node.scrollLeft;
              });
            }
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
        >
          <div className="broadcast-score-track">
            {group(false)}
            {group(true)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          aria-label={t(paused ? "common.play" : "music.pause")}
          title={t(paused ? "common.play" : "music.pause")}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </section>
      {selected && (
        <Suspense fallback={null}>
          <MatchDetails
            match={
              matches.find((match) => match.id === selected.id && match.game === selected.game) ??
              selected
            }
            onClose={() => setSelected(null)}
            onWatch={(stream) => {
              setSelected(null);
              onWatch?.(stream);
            }}
            portalTarget={document.fullscreenElement ?? document.body}
          />
        </Suspense>
      )}
    </>
  );
}
