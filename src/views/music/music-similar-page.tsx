import { MusicActionGlyph, useMusicActionReceipt } from "@/components/music/music-action-feedback";
import { MusicPlaylistToolbar } from "@/components/music/music-playlist-toolbar";
import { usePlaylistFilters } from "@/lib/music/use-playlist-filters";
import { LibraryTrackList } from "@/components/music/music-library-parts";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ListPlus, LoaderCircle, Pause, Play, Plus } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { MusicStickyTitle } from "@/components/music/music-sticky-title";
import { useCollectionPlayback } from "@/lib/music/use-collection-playback";
import "@/components/music/music-collection-controls.css";
import { MusicPlaylistCover } from "@/components/music/music-playlist-cover";
import "./music-playlist-page.css";
import { useT } from "@/lib/i18n";
import { artistCreditParts } from "@/lib/music/search-artists";
import { addTracksToMusicPlaylist, createMusicPlaylist } from "@/lib/music/library";
import { enqueueMusic, playMusic } from "@/lib/music/player";
import { recordMusicSimilarPlayback } from "@/lib/music/playback-origin";
import { useMusicContextTracks } from "@/lib/music/recent-context";
import type { MusicTrack } from "@/lib/music/types";

export function MusicSimilarPage({
  seed,
  tracks: initialTracks,
  state = "ready",
  label,
  contextId,
  onBack,
}: {
  seed: MusicTrack;
  tracks: MusicTrack[];
  state?: "loading" | "ready" | "error";
  label?: string;
  contextId?: string;
  onBack: () => void;
}) {
  const t = useT();
  const growingMix = useMusicContextTracks("similar", contextId?.startsWith("mix:surprise:") ? contextId : undefined);
  const tracks = growingMix ?? initialTracks;
  const [saved, setSaved] = useState<"idle" | "saving" | "done" | "error">("idle");
  const busy = state === "loading";
  const player = useMusicPlayback();
  const collection = usePlaylistFilters(contextId ?? seed.id, tracks);
  const visibleTracks = collection.tracks;

  const leads = useMemo(() => {
    const names = new Set<string>();
    for (const track of tracks) {
      const lead = (artistCreditParts(track.artist)[0] ?? track.artist).trim().toLowerCase();
      if (lead) names.add(lead);
    }
    return names.size;
  }, [tracks]);

  const start = (track: MusicTrack) => {
    recordMusicSimilarPlayback(
      seed,
      visibleTracks,
      label ? { id: contextId ?? label, name: label } : undefined,
    );
    void playMusic(track, visibleTracks).catch(() => {});
  };
  const { playing, busy: resolving, play: playAll } = useCollectionPlayback(visibleTracks, start);
  const controls = useRef<HTMLDivElement>(null);
  const title = label ?? t("music.similar.title", { title: seed.title });
  const playLabel = t(playing ? "music.pause" : "music.play");
  const saveLabel = t(saved === "done" ? "music.similar.saved" : saved === "error" ? "music.action.error" : "music.similar.save");
  const queued = useMusicActionReceipt(contextId ?? seed.id);
  const saveState = saved === "saving" ? "busy" : saved;
  const queueAll = () => {
    for (const track of visibleTracks) enqueueMusic(track);
    queued.confirm();
  };
  const save = () => {
    if (saved === "saving") return;
    setSaved("saving");
    void createMusicPlaylist(label ?? t("music.similar.playlistName", { title: seed.title }))
      .then((playlist) => addTracksToMusicPlaylist(playlist.id, visibleTracks))
      .then(() => setSaved("done"))
      .catch(() => setSaved("error"));
  };

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <button
        type="button"
        data-music-inner-back
        onClick={onBack}
        className="flex min-h-11 w-fit items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={17} className="dir-icon" aria-hidden="true" />
        {t("music.watch.back")}
      </button>

      <MusicStickyTitle title={title} tracks={visibleTracks} onPlay={start} revealAfter={controls} />
      <header className="music-library-playlist-hero">
        <div className="music-library-playlist-art"><MusicPlaylistCover artwork={(tracks.length ? tracks : [seed]).map(track => track.artwork)} seed={contextId ?? seed.id} glyphSize={48} /></div>
        <div className="music-library-playlist-meta">
        <h1 tabIndex={-1} className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-ink-muted">
          {busy
            ? t("music.similar.building")
            : state === "error"
              ? t("music.similar.error")
              : t("music.similar.subtitle", { count: tracks.length, artists: leads })}
        </p>

      <div ref={controls} className="music-collection-controls">
        <HoverTooltip label={playLabel}>
          <button type="button" onClick={playAll} disabled={busy || resolving || !visibleTracks.length} className="music-collection-play" aria-label={playLabel}>
            {resolving ? <LoaderCircle size={24} className="animate-spin motion-reduce:animate-none" aria-hidden /> : playing ? <Pause size={24} aria-hidden /> : <Play size={24} aria-hidden />}
          </button>
        </HoverTooltip>
        <HoverTooltip label={t("music.card.addToQueue")}>
          <button type="button" onClick={queueAll} disabled={busy || !visibleTracks.length} className="music-collection-extra music-action-button" data-music-action-state={queued.confirmed ? "done" : "idle"} aria-label={t("music.card.addToQueue")}><MusicActionGlyph state={queued.confirmed ? "done" : "idle"} idle={<ListPlus size={28} />} size={28} identity={contextId ?? seed.id} /></button>
        </HoverTooltip>
        <HoverTooltip label={saveLabel}>
          <button type="button" onClick={save} disabled={busy || !visibleTracks.length || saved === "saving" || saved === "done"} className="music-collection-extra music-action-button" data-music-action-state={saveState} aria-label={saveLabel} aria-busy={saved === "saving" || undefined}>
            <MusicActionGlyph state={saveState} idle={<Plus size={28} />} size={28} identity={contextId ?? seed.id} />
          </button>
        </HoverTooltip>
        {saved === "error" && <span role="alert" className="text-sm text-danger">{t("music.action.error")}</span>}
        {saved === "done" && <span role="status" className="sr-only">{saveLabel}</span>}
      </div>
        </div>
      </header>

      <MusicPlaylistToolbar controller={collection} loading={busy} />
      {state === "error" ? <p role="alert">{t("music.similar.error")}</p> : <LibraryTrackList
        title="" subtitle="" showControls={false} tracks={visibleTracks} view={collection.filters.view}
        likedIds={player.likedIds} selectedPlaylist={null} onPlay={start} filtering={busy}
        emptyCopy={t(collection.active ? "music.searchEmpty" : "music.row.emptyRow")}
      />}
    </section>
  );
}
