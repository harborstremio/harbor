import { useEffect } from "react";
import { isBigPictureActive, pushBigPicture } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { useProfiles } from "@/lib/profiles";
import { useView, type PlayEpisode } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { resolveLocalPlayVersions } from "@/lib/local-library/playback";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { metaIsAnime } from "@/lib/player/anime-src";
import { openLocalVersions } from "@/lib/player/local-versions-modal";
import { mediaServerConnections } from "@/lib/media-server/connections";
import { mediaServerItems } from "@/lib/media-server/index-store";
import { matchingServerItems, serverPlayableCopies } from "@/lib/media-server/selectors";
import { createMediaServerPlayerSrc, decidePlaybackSource } from "@/lib/media-server/playback";
import { requestBpPlay } from "@/views/big-picture/bp-play-request";

type RemoteOpen =
  | { action: "openMeta"; metaId: string; metaType: string; name?: string; poster?: string }
  | { action: "openService"; service: string }
  | { action: "goView"; view: string }
  | {
      action: "playMeta";
      metaId: string;
      metaType: string;
      name?: string;
      poster?: string;
      season?: number;
      episode?: number;
      resume?: boolean;
    };

type MetaOpen = Extract<RemoteOpen, { metaId: string }>;

function toMeta(d: MetaOpen): Meta {
  return {
    id: d.metaId,
    type: (d.metaType === "series"
      ? "series"
      : d.metaType === "anime"
        ? "anime"
        : "movie") as Meta["type"],
    name: d.name ?? "",
    poster: d.poster,
  };
}

/**
 * Host-side bridge: when a connected phone remote sends openMeta/playMeta, the
 * session dispatches a `harbor:remote-open` event; this drives the host's own
 * ViewProvider so the desktop opens the detail page or starts playback.
 */
export function RemoteOpenBridge() {
  const { openMeta, openPerson, openPicker, openPlayer, openService, setView } = useView();
  const { settings } = useSettings();
  const { selectProfile } = useProfiles();
  useEffect(() => {
    const onSetProfile = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) selectProfile(id);
    };
    window.addEventListener("harbor:remote-set-profile", onSetProfile);
    return () => window.removeEventListener("harbor:remote-set-profile", onSetProfile);
  }, [selectProfile]);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<RemoteOpen>).detail;
      if (!d) return;
      if (d.action === "goView") {
        setView(d.view as Parameters<typeof setView>[0]);
        return;
      }
      if (d.action === "openService") {
        openService(d.service as Parameters<typeof openService>[0]);
        return;
      }
      if (d.action === "openMeta" && d.metaId.startsWith("person:")) {
        const pid = Number(d.metaId.slice(7));
        if (Number.isFinite(pid)) openPerson(pid);
        return;
      }
      const meta = toMeta(d);
      if (isBigPictureActive()) {
        const metaId = `${meta.type}:${meta.id}`;
        if (d.action === "playMeta") requestBpPlay(metaId);
        pushBigPicture({ kind: "detail", metaId });
        return;
      }
      if (d.action === "openMeta") {
        openMeta(meta);
        return;
      }
      const episode: PlayEpisode | undefined =
        d.season != null && d.episode != null
          ? { season: d.season, episode: d.episode }
          : undefined;
      const stream = () =>
        openPicker(meta, episode, { autoPlay: settings.instantPlay, resume: d.resume ?? true });
      void (async () => {
        const tmdb = meta.id.match(/^tmdb:(?:movie|tv|series):(\d+)$/);
        const identity = {
          tmdbId: tmdb ? Number(tmdb[1]) : undefined,
          imdbId: meta.id.startsWith("tt") ? meta.id : undefined,
        };
        const local = resolveLocalPlayVersions(meta, episode ?? null);
        const connections = mediaServerConnections();
        const indexed = await mediaServerItems();
        const serverItems = matchingServerItems(
          indexed,
          identity,
          meta.type === "series" ? "series" : "movie",
          episode?.season,
          episode?.episode,
        );
        const serverCopies = serverPlayableCopies(serverItems, connections);
        const decision = decidePlaybackSource(settings, local.length, serverCopies);
        if (decision.kind === "online") {
          stream();
          return;
        }
        if (decision.kind === "local" && local[0]) {
          openPlayer(localPlayerSrc(local[0], metaIsAnime(meta), episode));
          return;
        }
        const playServer = async (copy: (typeof serverCopies)[number]) => {
          const item = serverItems.find(
            (candidate) =>
              candidate.connectionId === copy.connectionId && candidate.id === copy.itemId,
          );
          const connection =
            item && connections.find((candidate) => candidate.id === item.connectionId);
          if (!item || !connection) return;
          openPlayer(
            await createMediaServerPlayerSrc({
              meta,
              episode,
              connection,
              item,
              versionId: copy.version.id,
            }),
          );
        };
        if (decision.kind === "home-server") {
          await playServer(decision.copy);
          return;
        }
        openLocalVersions({
          title: meta.name,
          poster: meta.poster,
          entries: local,
          onPlayLocal: (entry) => openPlayer(localPlayerSrc(entry, metaIsAnime(meta), episode)),
          serverCopies,
          onPlayServer: playServer,
          onStream: stream,
        });
      })().catch(stream);
    };
    window.addEventListener("harbor:remote-open", onOpen);
    return () => window.removeEventListener("harbor:remote-open", onOpen);
  }, [openMeta, openPerson, openPicker, openPlayer, openService, setView, settings]);
  return null;
}
