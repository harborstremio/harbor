import { MusicHeroMedia } from "./music-hero-media";
import { useHeroLayers } from "./use-hero-layers";
import { MusicArtistLink } from "@/components/music/music-artist-link";
import { MusicTasteIcon } from "@/components/music/music-taste-icon";
import { MusicBillboardRank } from "@/components/music/music-billboard-rank";
import { useMusicItemMenu } from "@/components/music/music-item-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { classifyHomeRow } from "./music-home-rows";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Library,
  ListMusic,
  Pause,
  Play,
  Plus,
} from "@/components/icons/music-icons";
import { MusicNowPlayingMark } from "@/components/music/music-now-playing-mark";
import { useMusicSourcePicker } from "@/components/music/music-source-picker";
import { nowPlayingMatches } from "@/lib/music/now-playing-key";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import { MusicHomeHeroSkeleton } from "@/components/music/music-skeletons";
import { useT } from "@/lib/i18n";
import type { MusicCatalogItem, MusicCatalogRow, MusicTrack } from "@/lib/music/types";
import "./music-home.css";

export function MusicHomeHero({
  rows,
  recent: _recent,
  loading,
  active = true,
  onOpen,
  onLibrary,
  onConnect,
  onYouTube,
  onPlaylists,
  onTastes,
}: {
  rows: MusicCatalogRow[];
  recent: MusicTrack[];
  loading: boolean;
  active?: boolean;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onLibrary: () => void;
  onConnect: (id?: string) => void;
  onYouTube: () => void;
  onPlaylists: () => void;
  onTastes: () => void;
}) {
  const t = useT();
  const { openSourcePicker } = useMusicSourcePicker();
  const now = useMusicNowPlaying();
  const root = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);
  const reduce = useReducedMotion();
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [heroHover, setHeroHover] = useState(false);
  const [heroFocus, setHeroFocus] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const local = rows.filter((row) => row.source === "local").flatMap((row) => row.items);
  const charts = rows.filter(
    (row) => row.source !== "local" && classifyHomeRow(row, []) === "charts",
  );
  const catalog = [
    ...charts,
    ...rows.filter((row) => row.source !== "local" && !charts.includes(row)),
  ].flatMap((row) => row.items);
  const candidates = useMemo(
    () =>
      [
        ...catalog.filter((item) => item.kind === "track"),
        ...catalog.filter((item) => item.kind !== "track"),
      ]
        .filter((item) => item.kind === "track" || item.kind === "album")
        .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
        .slice(0, 6),
    [rows],
  );
  const [selectedId, setSelectedId] = useState("");
  const selected = Math.max(
    0,
    candidates.findIndex((item) => item.id === selectedId),
  );
  const feature = candidates[selected];
  const firstVisible = Math.min(
    Math.floor(selected / visibleCount) * visibleCount,
    Math.max(0, candidates.length - visibleCount),
  );
  const visibleCandidates = candidates.slice(firstVisible, firstVisible + visibleCount);
  const itemMenu = useMusicItemMenu({ onOpen: (item) => onOpen(item, candidates) });
  const move = (step: number) =>
    setSelectedId(candidates[(selected + step + candidates.length) % candidates.length]?.id ?? "");
  useEffect(() => {
    const el = selector.current;
    if (!el) return;
    const measure = () =>
      setVisibleCount(
        Math.max(1, Math.min(candidates.length, Math.floor((el.clientWidth + 8) / 158))),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [candidates.length]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(el);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (
      !active ||
      !visible ||
      !pageVisible ||
      reduce ||
      paused ||
      hovering ||
      focused ||
      candidates.length < 2
    )
      return;
    const timer = setTimeout(
      () => setSelectedId(candidates[(selected + 1) % candidates.length].id),
      8000,
    );
    return () => clearTimeout(timer);
  }, [active, visible, pageVisible, reduce, paused, hovering, focused, candidates, selected]);
  const artwork = feature?.artwork;
  const backdrops = useHeroLayers(artwork);
  const title = feature?.title;
  const artist = feature?.artist;
  const imported = local.length > 0;
  if (loading && rows.length === 0) return <MusicHomeHeroSkeleton />;
  return (
    <div
      ref={root}
      className="music-home-intro"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <section
        className="music-home-feature"
        onPointerEnter={() => setHeroHover(true)}
        onPointerLeave={() => setHeroHover(false)}
        onFocus={() => setHeroFocus(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHeroFocus(false);
        }}
      >
        {backdrops.map((layer) => (
          <img key={layer.id} className="music-feature-backdrop" src={layer.src} alt="" />
        ))}
        <div className="music-home-feature-copy">
          <div key={feature?.id ?? "intro"} className="music-home-feature-swap">
            <span className="music-home-eyebrow">
              {charts.length
                ? charts[0].titleLiteral
                  ? charts[0].title
                  : t(charts[0].title)
                : t("music.home.discover")}
            </span>
            <h2>{title || t("music.home.title")}</h2>
            <p>
              {artist ? (
                <MusicArtistLink
                  name={artist}
                  track={feature?.kind === "track" ? feature : undefined}
                />
              ) : (
                t("music.home.body")
              )}
            </p>
            <div className="music-home-feature-actions">
              {feature?.kind === "track" ? (
                <button
                  type="button"
                  className="music-collection-play"
                  aria-label={t("music.playTrack", {
                    title: feature.title,
                    artist: feature.artist,
                  })}
                  title={t("music.play")}
                  onClick={() =>
                    openSourcePicker(
                      feature,
                      candidates.flatMap((item) => (item.kind === "track" ? [item] : [])),
                    )
                  }
                >
                  <Play size={24} fill="currentColor" aria-hidden />
                </button>
              ) : feature ? (
                <button
                  type="button"
                  className="music-home-primary"
                  onClick={() => onOpen(feature, candidates)}
                >
                  {t("music.home.exploreRelease")}
                  <ArrowUpRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="music-home-primary"
                  onClick={() => onConnect("local")}
                >
                  <FolderOpen size={18} />
                  {t("music.home.addFolder")}
                </button>
              )}
              {feature?.kind === "track" && (
                <button
                  type="button"
                  className="music-home-text"
                  onClick={() => onOpen(feature, candidates)}
                >
                  <ArrowUpRight size={17} />
                  {t("music.discover")}
                </button>
              )}
              <button type="button" className="music-home-text" onClick={onPlaylists}>
                <ListMusic size={17} />
                {t("music.taste.playlists")}
              </button>
              <button type="button" className="music-home-text" onClick={onTastes}>
                <MusicTasteIcon size={17} />
                {t("music.taste.choose")}
              </button>
            </div>
          </div>
        </div>
        <MusicHeroMedia
          item={feature}
          hovering={active && pageVisible && visible && (heroHover || heroFocus)}
          onMenu={feature ? itemMenu.openFor(feature, selected) : undefined}
        />
        {feature?.kind === "track" && (
          <MusicBillboardRank
            title={feature.title}
            artist={feature.artist}
            logoSize={11}
            className="pointer-events-none absolute bottom-3.5 end-3.5 z-[2] inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink ring-1 ring-edge-soft/60"
          />
        )}
      </section>
      {candidates.length > 1 && (
        <div className="music-feature-browse">
          <div
            ref={selector}
            className="music-feature-selector"
            style={{ gridTemplateColumns: `repeat(${visibleCandidates.length}, minmax(0, 1fr))` }}
          >
            {visibleCandidates.map((item, index) => (
              <div
                key={item.id}
                className="music-feature-choice"
                data-selected={item.id === feature?.id}
                onContextMenu={itemMenu.openFor(item, firstVisible + index)}
              >
                {item.kind === "track" && nowPlayingMatches(now, item) && (
                  <MusicNowPlayingMark loading={now.phase === "resolving"} />
                )}
                <button
                  type="button"
                  aria-pressed={item.id === feature?.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.artwork && <img src={item.artwork} alt="" />}
                  <span>
                    <strong>{item.title}</strong>
                  </span>
                </button>
                <MusicArtistLink
                  name={item.artist}
                  track={item.kind === "track" ? item : undefined}
                  className="music-feature-artist"
                />
              </div>
            ))}
          </div>
          <div className="music-feature-controls">
            <span dir="ltr">
              {selected + 1} / {candidates.length}
            </span>
            <button type="button" onClick={() => move(-1)} aria-label={t("common.previous")}>
              <ChevronLeft className="dir-icon" size={18} />
            </button>
            {!reduce && (
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={t(paused ? "music.taste.resume" : "music.taste.pause")}
                aria-pressed={paused}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            )}
            <button type="button" onClick={() => move(1)} aria-label={t("common.next")}>
              <ChevronRight className="dir-icon" size={18} />
            </button>
          </div>
        </div>
      )}
      <section className="music-home-local">
        <div className="music-home-local-title">
          <FolderOpen size={24} />
          <div>
            <h3>{t("music.home.yourFiles")}</h3>
            <p>{t("music.home.filesBody")}</p>
          </div>
        </div>
        <button type="button" onClick={() => onConnect("local")}>
          <Plus size={17} />
          {t(imported ? "music.home.manageFolders" : "music.home.addFolder")}
        </button>
      </section>
      <nav className="music-home-services" aria-label={t("music.hero.startCta")}>
        <button type="button" onClick={onLibrary}>
          <Library size={17} />
          {t("music.library")}
        </button>
        <button type="button" onClick={() => onConnect("spotify")}>
          <MusicServiceLogo source="spotify" />
          Spotify
          <ArrowUpRight size={14} />
        </button>
        <button type="button" onClick={onYouTube}>
          <MusicServiceLogo source="youtube_music" />
          YouTube Music
          <ArrowUpRight size={14} />
        </button>
        <button type="button" onClick={() => onConnect()}>
          <Plus size={19} />
          {t("music.hero.startCta")}
        </button>
      </nav>
      {itemMenu.menu}
    </div>
  );
}
