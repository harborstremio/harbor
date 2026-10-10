import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { useMediaQuery } from "@/lib/use-media-query";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import type { EsportsMatch } from "@/lib/sports/esports-feeds";
import type { EsportsStream } from "@/lib/sports/esports-streams";
import { EsportsGameLogo, EsportsImage } from "./esports-image";
import "./esports-hero.css";

export function EsportsHero({
  matches,
  active,
  loading,
  onOpen,
  onWatch,
  onExplore,
}: {
  matches: EsportsMatch[];
  active: boolean;
  loading: boolean;
  onOpen: (match: EsportsMatch) => void;
  onWatch: (stream: EsportsStream) => void;
  onExplore: () => void;
}) {
  const t = useT();
  const locale = useUiLanguage();
  const { ref: picksRef, handlers: picksHandlers } = useDragScroll<HTMLDivElement>();
  const root = useRef<HTMLElement>(null);
  const visible = useInViewport(root);
  const pageVisible = usePageVisible();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [selected, setSelected] = useState("");
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const candidates = matches.filter(
    (match) => match.state === "live" || match.state === "upcoming",
  );
  // Introduce each game before filling the remaining places with more matches.
  const first = candidates.filter(
    (match, i) => candidates.findIndex((other) => other.game === match.game) === i,
  );
  const slides = [...first, ...candidates.filter((match) => !first.includes(match))].slice(0, 8);
  const index = Math.max(
    0,
    slides.findIndex((match) => match.id === selected),
  );
  const match = slides[index];
  const game = ESPORTS_GAMES.find((game) => game.id === match?.game);
  // Keep the selected event stable as other providers finish loading.
  useEffect(() => {
    if (match && !slides.some((item) => item.id === selected)) setSelected(match.id);
  }, [match?.id, selected]);
  const next = (direction: number) =>
    setSelected(slides[(index + direction + slides.length) % slides.length]?.id || "");
  const signature = slides.map((match) => match.id).join("|");
  useEffect(() => {
    if (
      !active ||
      !visible ||
      !pageVisible ||
      reduced ||
      paused ||
      hovered ||
      focused ||
      slides.length < 2
    )
      return;
    const timer = setTimeout(() => setSelected(slides[(index + 1) % slides.length].id), 7000);
    return () => clearTimeout(timer);
  }, [active, visible, pageVisible, reduced, paused, hovered, focused, index, signature]);
  return (
    <section
      ref={root}
      className="ea-feature ea-home-hero"
      aria-label={t("Featured event")}
      style={{ "--ea-game-accent": game?.accent } as CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="ea-home-slide sh-hero" key={match?.id || "empty"}>
        {game?.art && <EsportsHeroArt key={game.art} src={game.art} />}
        <div className="ea-feature-copy sh-hero-copy">
          <div className="ea-feature-meta">
            {game && <EsportsGameLogo key={game.id} game={game} />}
            <span>{match?.event.name || t("Esports")}</span>
            {match?.state === "live" && <b className="ea-live">{t("Live now")}</b>}
          </div>
          {match ? (
            <>
              <h2>
                {match.teams[0].name}
                <span>{t("vs")}</span>
                {match.teams[1].name}
              </h2>
              <p>
                {match.state === "live"
                  ? t("Live match")
                  : new Date(match.startMs).toLocaleString(locale, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                {match.bestOf ? ` · ${t("Best of {count}", { count: match.bestOf })}` : ""}
              </p>
            </>
          ) : (
            <>
              <h2>{t("Esports")}</h2>
              <p role="status">
                {t(
                  loading
                    ? "Loading matches…"
                    : "Explore the games, meet the teams, and watch the official channels.",
                )}
              </p>
            </>
          )}
          <div className="ea-feature-actions">
            <button
              className="sh-button sh-button-primary"
              onClick={() => (match ? onOpen(match) : onExplore())}
            >
              {t(match ? "Match center" : "All matches")}
              <ArrowRight size={17} />
            </button>
            {match?.streams[0] && (
              <button className="sh-button" onClick={() => onWatch(match.streams[0])}>
                <Play size={17} />
                {t("Watch broadcast")}
              </button>
            )}
          </div>
        </div>
        {match && (
          <div className="ea-feature-versus">
            <EsportsImage src={match.teams[0].logo} name={match.teams[0].name} />
            <span>
              {match.state === "live" && match.teams.every((team) => team.score !== undefined)
                ? `${match.teams[0].score} : ${match.teams[1].score}`
                : "VS"}
            </span>
            <EsportsImage src={match.teams[1].logo} name={match.teams[1].name} />
          </div>
        )}
      </div>
      {!!slides.length && (
        <div className="ea-home-controls sh-carousel-bottom">
          <div className="ea-home-picks" ref={picksRef} {...picksHandlers}>
            {slides.map((item, i) => (
              <button
                key={item.id}
                aria-pressed={i === index}
                onClick={() => setSelected(item.id)}
                aria-label={`${item.teams[0].name} · ${item.teams[1].name}`}
              >
                <span className="ea-home-pick-logos">
                  {item.teams.map((team, side) => (
                    <EsportsImage key={`${side}:${team.id}`} src={team.logo} name={team.name} />
                  ))}
                </span>
                <span>
                  {item.teams[0].name} · {item.teams[1].name}
                </span>
              </button>
            ))}
          </div>
          <span>
            {index + 1} / {slides.length}
          </span>
          <button
            className="sh-icon"
            disabled={slides.length < 2}
            aria-label={t("Previous")}
            onClick={() => next(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="sh-icon"
            disabled={slides.length < 2}
            aria-label={t("Next")}
            onClick={() => next(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="sh-icon"
            aria-label={t(paused ? "Play" : "Pause")}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
      )}
    </section>
  );
}

/** Never show an unrelated game or a partially decoded frame while artwork loads. */
function EsportsHeroArt({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  return (
    <img
      className="ea-feature-art"
      src={src}
      alt=""
      decoding="async"
      data-ready={ready}
      onLoad={async (event) => {
        const image = event.currentTarget;
        try {
          await image.decode();
          setReady(true);
        } catch {
          setReady(false);
        }
      }}
      onError={() => setReady(false)}
    />
  );
}
