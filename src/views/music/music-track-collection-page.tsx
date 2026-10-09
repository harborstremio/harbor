import { MusicPlaylistToolbar } from "@/components/music/music-playlist-toolbar";
import { usePlaylistFilters } from "@/lib/music/use-playlist-filters";
import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, Clock3, Heart } from "@/components/icons/music-icons";
import { useSectionBack } from "@/lib/section-back";
import { LibraryTrackList } from "@/components/music/music-library-parts";
import { MusicStickyTitle } from "@/components/music/music-sticky-title";
import type { MusicTrack } from "@/lib/music/types";
import { MusicCollectionControls } from "@/components/music/music-collection-controls";
import { MusicLastFm } from "@/components/music/music-lastfm";
import { useMusicSourcePicker } from "@/components/music/music-source-picker";
import { recordMusicLibraryPlayback } from "@/lib/music/playback-origin";
import { recordMusicDestination } from "@/lib/music/recent-destinations";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import { useT } from "@/lib/i18n";
import "./music-playlist-page.css";

export type MusicTrackCollectionKind = "liked" | "recent";

export function MusicTrackCollectionPage({
  kind,
  active = true,
  onBack,
}: {
  kind: MusicTrackCollectionKind;
  active?: boolean;
  onBack: () => void;
}) {
  const t = useT();
  const player = useMusicPlayback();
  const { openSourcePicker } = useMusicSourcePicker();
  const heading = useRef<HTMLDivElement>(null);

  const tracks = kind === "liked" ? player.likedTracks : player.recents;
  const title = kind === "liked" ? t("music.saved") : t("music.library.recent");

  useEffect(() => {
    if (kind !== "liked" || tracks.length === 0) return;
    recordMusicDestination({
      kind: "liked",
      id: "saved",
      name: t("music.saved"),
      artwork: tracks.find((track) => track.artwork)?.artwork ?? "",
    });
  }, [kind, tracks, t]);

  const close = useCallback(() => onBack(), [onBack]);
  useSectionBack(close, active);
  useEffect(() => {
    if (!active) return;
    heading.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.target instanceof HTMLInputElement ||
        document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [active, close]);

  const collection = usePlaylistFilters(kind, tracks, { recentFirst: true });
  const visibleTracks = collection.tracks;

  const play = (track: MusicTrack, queue: MusicTrack[]) => {
    recordMusicLibraryPlayback(kind, title, queue);
    openSourcePicker(track, queue);
  };

  return (
    <section className="music-playlist-page">
      <button
        type="button"
        data-music-inner-back
        onClick={close}
        className="music-playlist-page-back"
      >
        <ChevronLeft size={17} />
        {t("music.watch.back")}
      </button>
      <MusicStickyTitle revealAfter={heading} title={title} tracks={visibleTracks} onPlay={play} />
      <div className="music-library-playlist-hero" ref={heading} tabIndex={-1}>
        <div className="music-library-playlist-art">
          <span className="music-collection-pinned" data-pinned={kind}>
            {kind === "liked" ? <Heart size={48} /> : <Clock3 size={48} />}
          </span>
        </div>
        <div className="music-library-playlist-meta">
          <h2 className="music-collection-page-title">{title}</h2>
          <div className="music-playlist-commands">
            <MusicCollectionControls
              tracks={visibleTracks}
              onPlay={play}
            />
          </div>
          <span>{t("music.card.trackCount", { count: tracks.length })}</span>
        </div>
      </div>
      <MusicPlaylistToolbar controller={collection} recentLabel={kind === "recent" ? t("music.sort.recent") : undefined} />
      <LibraryTrackList
        showControls={false}
        onPlay={play}
        title=""
        subtitle=""
        view={collection.filters.view}
        tracks={visibleTracks}
        likedIds={player.likedIds}
        selectedPlaylist={null}
        emptyCopy={t(
          collection.active
            ? "music.searchEmpty"
            : kind === "liked"
              ? "music.library.saveEmpty"
              : "music.library.historyEmpty",
        )}
      />
      {kind === "recent" && (
        <details className="music-library-lastfm">
          <summary>Last.fm</summary>
          <MusicLastFm />
        </details>
      )}
    </section>
  );
}
