import { racingVenue } from "@/lib/sports/racing-venues";
import { useEventVenuePhoto } from "./use-event-venue-photo";
import { TeamProfileLink, teamIdentity } from "./team-profile-link";

import "./team-links.css";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { useT } from "@/lib/i18n";

import { useMediaQuery } from "@/lib/use-media-query";

import { useInViewport, usePageVisible } from "@/lib/visibility";

import type { SportsGame } from "@/lib/sports/espn";

import { gameKey } from "@/lib/sports/hub-cache";

import { hubLeague } from "@/lib/sports/hub-data";

import { useDragScroll } from "@/lib/use-drag-scroll";

import { EventLogo, HubHero } from "./hub-cards";

import { useSportsArtwork } from "./use-artwork";

export function HubCarousel({
  games,

  active,

  loading,

  stale,

  onOpen,

  onCustomize,
}: {
  games: SportsGame[];

  active: boolean;

  loading: boolean;

  stale: boolean;

  onOpen: (game: SportsGame) => void;

  onCustomize: () => void;
}) {
  const t = useT();

  const { ref: picksRef, handlers: picksHandlers } = useDragScroll<HTMLDivElement>();

  const [selected, setSelected] = useState(() => (games[0] ? gameKey(games[0]) : ""));

  const [paused, setPaused] = useState(false);

  const [hovered, setHovered] = useState(false);

  const [focused, setFocused] = useState(false);

  const root = useRef<HTMLDivElement>(null);

  const visible = usePageVisible();

  const inView = useInViewport(root, true);

  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");

  const index = Math.max(
    0,

    games.findIndex((game) => gameKey(game) === selected),
  );

  const game = games[index];

  const currentKey = game ? gameKey(game) : "loading";

  useLayoutEffect(() => {
    // Pin the first visible event as feeds arrive, rather than following a changing index 0.

    if (game && selected !== currentKey) setSelected(currentKey);
  }, [currentKey, selected]);

  const previous = useRef(game);

  const [leaving, setLeaving] = useState<SportsGame>();

  const next = games.length > 1 ? games[(index + 1) % games.length] : undefined;

  const nextVenuePhoto = useEventVenuePhoto(next, active && visible && inView);
  const nextArt = useSportsArtwork(
    active && visible && inView && !nextVenuePhoto ? next : undefined,
  );

  useEffect(() => {
    if (!active || !visible || !inView || !next) return;

    const urls = [
      nextVenuePhoto?.photo,
      next.artwork,
      next.poster,

      nextArt.backdrop,

      nextArt.away || next.away.logo,

      nextArt.home || next.home.logo,
    ].filter((url): url is string => !!url);

    const images = [...new Set(urls)].map((src) => {
      const image = new Image();

      image.decoding = "async";

      image.fetchPriority = "low";

      image.src = src;

      return image;
    });

    return () => {
      for (const image of images) image.src = "";
    };
  }, [
    active,

    visible,

    inView,

    next?.id,

    nextArt.backdrop,
    nextVenuePhoto?.photo,
    nextArt.home,

    nextArt.away,
  ]);

  useLayoutEffect(() => {
    const old = previous.current;

    previous.current = game;

    if (reduce || !old || gameKey(old) === currentKey) {
      setLeaving(undefined);

      return;
    }

    setLeaving(old);

    const timer = setTimeout(() => setLeaving(undefined), 420);

    return () => clearTimeout(timer);
  }, [currentKey, reduce]);

  const signature = games.map(gameKey).join(",");

  useLayoutEffect(() => {
    const strip = picksRef.current;
    if (!strip || !active) return;
    const revealSelected = (smooth: boolean) => {
      const pick = strip.querySelector<HTMLElement>('[data-selected="true"]');
      if (!pick || !strip.clientWidth) return;
      const viewport = strip.getBoundingClientRect();
      const bounds = pick.getBoundingClientRect();
      const left = viewport.left + strip.clientLeft;
      const right = left + strip.clientWidth;
      const delta =
        bounds.left < left ? bounds.left - left : bounds.right > right ? bounds.right - right : 0;
      if (Math.abs(delta) > 1) {
        // Scroll this strip only; scrollIntoView can also move the whole page.
        strip.scrollBy({ left: delta, behavior: smooth ? "smooth" : "instant" });
      }
    };
    revealSelected(!reduce);
    let width = strip.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === strip.clientWidth) return;
      width = strip.clientWidth;
      revealSelected(false);
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, [currentKey, signature, active, reduce, picksRef]);

  const playing =
    active && visible && inView && !reduce && !paused && !hovered && !focused && games.length > 1;

  useEffect(() => {
    if (!playing) return;

    const keys = signature.split(",");

    const timer = setTimeout(
      () => setSelected(keys[(index + 1) % keys.length]),

      9000,
    );

    return () => clearTimeout(timer);
  }, [playing, signature, index]);

  const go = (delta: number) =>
    setSelected(gameKey(games[(index + delta + games.length) % games.length]));

  return (
    <div
      ref={root}

      className="sh-carousel"

      role="region"

      aria-roledescription={t("Carousel")}

      aria-label={t("Featured matches")}

      onMouseEnter={() => setHovered(true)}

      onMouseLeave={() => setHovered(false)}

      onFocusCapture={() => setFocused(true)}

      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className="sh-carousel-stage">
        <HubHero
          key={currentKey}

          game={game}

          onOpen={onOpen}

          onCustomize={onCustomize}

          loading={loading}

          stale={stale}
        />

        {leaving && (
          <div
            key={gameKey(leaving)}

            className="sh-carousel-leaving"

            inert

            aria-hidden="true"
          >
            <HubHero
              game={leaving}

              onOpen={onOpen}

              onCustomize={onCustomize}

              loading={false}

              stale={stale}
            />
          </div>
        )}
      </div>

      {!!games.length && (
        <div className="sh-carousel-bottom">
          <div className="sh-carousel-picks" ref={picksRef} {...picksHandlers}>
            {games.map((item, i) => (
              <div className="sh-carousel-pick" key={gameKey(item)} data-selected={index === i}>
                <button
                  className="sh-event-open"
                  aria-pressed={index === i}
                  onClick={() => setSelected(gameKey(item))}
                  aria-label={item.context?.name || `${item.away.name} · ${item.home.name}`}
                />

                <span className="sh-pick-logos">
                  {item.home.logo || item.away.logo ? (
                    [item.home, item.away].map((side, j) => (
                      <span key={j}>
                        <EventLogo
                          side={side}

                          fallback={hubLeague(item.league)?.logo}

                          sport={hubLeague(item.league)?.group}
                        />
                      </span>
                    ))
                  ) : (
                    <EventLogo
                      side={{
                        ...item.home,

                        logo: racingVenue(item)?.logo || hubLeague(item.league)?.logo || "",
                      }}

                      fallback={hubLeague(item.league)?.logo}

                      sport={hubLeague(item.league)?.group}
                    />
                  )}
                </span>

                <span>
                  <small>
                    {item.state === "in" && item.savedAt === undefined
                      ? t("Live now")
                      : item.league}
                  </small>

                  <strong>
                    {item.context?.name || (
                      <>
                        <TeamProfileLink team={teamIdentity(item, "away")}>
                          {item.away.abbr || item.away.name}
                        </TeamProfileLink>{" "}
                        ·{" "}
                        <TeamProfileLink team={teamIdentity(item, "home")}>
                          {item.home.abbr || item.home.name}
                        </TeamProfileLink>
                      </>
                    )}
                  </strong>
                </span>
              </div>
            ))}
          </div>

          <div className="sh-carousel-controls">
            <span>
              {String(index + 1).padStart(2, "0")} / {String(games.length).padStart(2, "0")}
            </span>

            <button
              className="sh-icon"

              aria-label={t("Previous featured event")}

              disabled={games.length < 2}

              onClick={() => go(-1)}
            >
              <ChevronLeft size={18} />
            </button>

            <button
              className="sh-icon"

              aria-label={t("Next featured event")}

              disabled={games.length < 2}

              onClick={() => go(1)}
            >
              <ChevronRight size={18} />
            </button>

            <button
              className="sh-icon"

              aria-label={t(paused ? "Play carousel" : "Pause carousel")}

              aria-pressed={paused}

              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
