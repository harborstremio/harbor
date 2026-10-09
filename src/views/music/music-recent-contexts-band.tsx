import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { useMusicSourcePicker } from "@/components/music/music-source-picker";
import { listMusicPlaylists } from "@/lib/music/library";
import { recordMusicPlaylistPlayback, recordMusicSimilarPlayback } from "@/lib/music/playback-origin";
import "./music-recent-contexts-band.css";
import { requestMusicPlaylist } from "@/lib/music/navigation";
import {
  getMusicRecentContexts,
  reopenMusicMix,
  useMusicRecentContexts,
  useMusicTrackContext,
  refreshMusicRecentContextArtwork,
  type MusicRecentContext,
} from "@/lib/music/recent-context";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { localRow, type MusicBand, type MusicBandContext } from "./music-band-types";

type Translate = MusicBandContext["t"];

function contextItems(contexts: readonly MusicRecentContext[], t: Translate): MusicCatalogItem[] {
  return contexts.map((context) => ({
    kind: "playlist",
    id: `${context.kind}:${context.id}`,
    connectorId: "local",
    name: context.name,
    artwork: context.artwork,
    subtitle: t(
      context.kind === "similar" ? "music.card.moreLikeThis" : "music.recentContexts.playlist",
    ),
  }));
}

function MusicRecentContextsRow({
  t,
  title,
  current,
}: {
  t: Translate;
  title: string;
  current: MusicTrack | null;
}) {
  const contexts = useMusicRecentContexts();
  const healed = useRef(false);
  useEffect(() => {
    if (healed.current) return;
    const stale = contexts.filter(
      (context) =>
        context.id.startsWith("spooktober:") &&
        context.artwork.every((url) => !url || url.includes("/spooktober/assets/")),
    );
    if (!stale.length) return;
    healed.current = true;
    void import("@/views/spooktober/spooktober-music")
      .then(({ loadSpooktoberMusic, spooktoberAsset }) =>
        loadSpooktoberMusic().then((data) => {
          const songs = new Map(data.songs.map((song) => [song.id, song]));
          refreshMusicRecentContextArtwork(
            new Map(data.playlists.map((entry) => [
              `spooktober:${entry.id}`,
              entry.songIds
                .map((id) => songs.get(id))
                .filter((song) => Boolean(song?.poster))
                .slice(0, 8)
                .map((song) => spooktoberAsset(song!.poster)),
            ])),
          );
        }),
      )
      .catch(() => {});
  }, [contexts]);
  const [note, setNote] = useState<"loading" | "error" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { openSourcePicker } = useMusicSourcePicker();
  const liveContext = useMusicTrackContext(current);
  const liveItemId = liveContext ? `${liveContext.kind}:${liveContext.id}` : null;
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const play = async (context: MusicRecentContext) => {
    const current = ++request.current;
    setBusy(`${context.kind}:${context.id}`);
    setNote(null);
    try {
      const playlist = context.kind === "playlist"
        ? context.id.startsWith("spooktober:")
          ? await (async () => {
              const { loadSpooktoberMusic, spooktoberSongToTrack } = await import("@/views/spooktober/spooktober-music");
              const data = await loadSpooktoberMusic();
              const festival = data.playlists.find((item) => `spooktober:${item.id}` === context.id);
              const byId = new Map(data.songs.map((song) => [song.id, song]));
              return festival ? { id: context.id, name: context.name, tracks: festival.songIds.map((id) => spooktoberSongToTrack(byId.get(id)!)) } : null;
            })()
          : (await listMusicPlaylists()).find((item) => item.id === context.id)
        : null;
      const tracks = context.kind === "playlist"
        ? playlist?.tracks ?? []
        : context.seed
          ? await (await import("@/lib/music/radio")).loadSimilarTracks(context.seed)
          : [];
      if (current !== request.current) return;
      const queue = tracks.length ? tracks : context.kind === "similar" && context.seed ? [context.seed] : [];
      if (!queue[0]) {
        setNote("error");
        return;
      }
      if (playlist) recordMusicPlaylistPlayback(playlist);
      else if (context.seed)
        recordMusicSimilarPlayback(context.seed, queue, { id: context.id, name: context.name });
      openSourcePicker(queue[0], queue);
    } catch {
      if (current === request.current) setNote("error");
    } finally {
      if (current === request.current) setBusy(null);
    }
  };
  const open = (context: MusicRecentContext) => {
    const current = ++request.current;
    if (context.kind === "playlist") {
      setBusy(null);
      setNote(null);
      requestMusicPlaylist(context.id);
      return;
    }
    if (!context.seed) return;
    setNote("loading");
    setBusy(`${context.kind}:${context.id}`);
    void reopenMusicMix(context)
      .then(() => { if (current === request.current) setNote(null); })
      .catch(() => { if (current === request.current) setNote("error"); })
      .finally(() => { if (current === request.current) setBusy(null); });
  };
  if (contexts.length === 0) return null;
  return (
    <section className="music-recent-contexts flex min-w-0 flex-col gap-3" data-busy={busy ?? undefined}>
      <MusicCatalogRow
        playingItemId={busy}
        row={localRow(
          "recent-contexts",
          title,
          t("music.recentContexts.subtitle"),
          "covers",
          contextItems(contexts, t),
        )}
        onOpen={(_item, index) => {
          const context = contexts[index];
          if (context) open(context);
        }}
        liveItemId={liveItemId}
        onPlay={(_item, index) => {
          const context = contexts[index];
          if (context) void play(context);
        }}
      />
      {note && (
        <p
          role={note === "error" ? "alert" : "status"}
          data-state={note}
          className="music-recent-contexts-note ps-[9px] text-[13px]"
        >
          {note === "loading" && (
            <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {t(note === "error" ? "music.error.load" : "music.similar.building")}
        </p>
      )}
    </section>
  );
}

export function recentContextsBand(ctx: MusicBandContext): MusicBand | null {
  if (getMusicRecentContexts().length === 0) return null;
  return {
    key: "recent-contexts",
    title: ctx.t("music.recentContexts.title"),
    catalog: false,
    render: (title) => (
      <MusicRecentContextsRow t={ctx.t} title={title} current={ctx.player.current} />
    ),
  };
}
