import { useCallback } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { buildCatchupUrl } from "@/lib/iptv/catchup";
import { headersFromChannel } from "@/lib/iptv/channel-headers";
import { recordChannelPlay } from "@/lib/iptv/channel-stats";
import { buildM3u, suggestExportFilename } from "@/lib/iptv/export";
import { findCurrent } from "@/lib/iptv/xmltv";
import type { EpgIndex, EpgProgram, IptvChannel, IptvPlaylist } from "@/lib/iptv/types";
import type { Meta } from "@/lib/cinemeta";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { useView } from "@/lib/view";

export function synthChannelMeta(ch: IptvChannel): Meta {
  return {
    id: `iptv:${ch.id}`,
    type: "tv",
    name: ch.name,
    poster: ch.logo ?? undefined,
    logo: ch.logo ?? undefined,
    background: ch.logo ?? undefined,
    description: ch.group ? `Live channel: ${ch.group}` : "Live channel",
    releaseInfo: "Live",
  };
}

export function useLiveActions(params: {
  epg: EpgIndex | null;
  activeId: string | null;
  playlist: IptvPlaylist | null;
}) {
  const { epg, activeId, playlist } = params;
  const { openPlayer } = useView();
  const playlists = usePlaylists();

  const handlePlay = useCallback(
    (ch: IptvChannel) => {
      recordChannelPlay(ch);
      const programs = ch.tvgId ? epg?.byChannel.get(ch.tvgId) : undefined;
      const liveProgram = findCurrent(programs, Date.now()).current?.title ?? undefined;
      openPlayer({
        meta: synthChannelMeta(ch),
        url: ch.url,
        title: ch.name,
        subtitle: ch.group ?? "Live",
        notWebReady: true,
        isLive: true,
        headers: headersFromChannel(ch),
        liveProgram,
      });
    },
    [openPlayer, epg],
  );

  const handlePlayCatchup = useCallback(
    (ch: IptvChannel, program: EpgProgram) => {
      const url = buildCatchupUrl(ch, program.startMs, program.endMs);
      if (!url) {
        handlePlay(ch);
        return;
      }
      openPlayer({
        meta: synthChannelMeta(ch),
        url,
        title: program.title || ch.name,
        subtitle: `${ch.name} · catch up`,
        notWebReady: true,
        isLive: true,
        headers: headersFromChannel(ch),
        liveProgram: program.title || undefined,
      });
    },
    [openPlayer, handlePlay],
  );

  const exportPlaylist = useCallback(
    async (id: string) => {
      if (id !== activeId || !playlist) return;
      const source = playlists.find((s) => s.id === id);
      const filename = suggestExportFilename(source?.name ?? "playlist");
      try {
        const target = await saveDialog({
          defaultPath: filename,
          filters: [{ name: "M3U Playlist", extensions: ["m3u", "m3u8"] }],
        });
        if (!target) return;
        await writeTextFile(target, buildM3u(playlist.channels, playlist.epgUrl));
      } catch (e) {
        console.warn("[live] export playlist failed", e);
      }
    },
    [activeId, playlist, playlists],
  );

  return { handlePlay, handlePlayCatchup, exportPlaylist };
}
