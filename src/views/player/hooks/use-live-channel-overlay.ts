import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { headersFromChannel } from "@/lib/iptv/channel-headers";
import type { IptvChannel, IptvPlaylistSource } from "@/lib/iptv/types";
import type { Meta } from "@/lib/cinemeta";
import type { PlayerSrc } from "@/lib/view";

export function useLiveChannelOverlay(params: {
  src: PlayerSrc;
  replacePlayerSrc: (src: PlayerSrc) => void;
}) {
  const { src, replacePlayerSrc } = params;
  const playlists = usePlaylists();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isLive = src.meta.id?.startsWith("iptv:") ?? false;
  const [overrideSourceId, setOverrideSourceId] = useState<string | null>(null);

  const playingSource: IptvPlaylistSource | null = useMemo(() => {
    if (!isLive) return null;
    const stripped = src.meta.id.replace(/^iptv:/, "");
    const playlistId = stripped.split("::")[0];
    if (!playlistId) return null;
    const found = playlists.find((p) => p.id === playlistId);
    if (!found) return null;
    return { id: found.id, name: found.name, url: found.url, epgUrl: found.epgUrl };
  }, [isLive, src.meta.id, playlists]);

  const activeSource: IptvPlaylistSource | null = useMemo(() => {
    if (!overrideSourceId) return playingSource;
    const found = playlists.find((p) => p.id === overrideSourceId);
    if (!found) return playingSource;
    return { id: found.id, name: found.name, url: found.url, epgUrl: found.epgUrl };
  }, [overrideSourceId, playingSource, playlists]);

  const availableSources: IptvPlaylistSource[] = useMemo(
    () =>
      playlists.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        epgUrl: p.epgUrl,
      })),
    [playlists],
  );

  const selectSource = useCallback((id: string) => {
    setOverrideSourceId(id);
    setGroup(null);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!isLive) setOpen(false);
  }, [isLive]);

  useEffect(() => {
    if (open) return;
    setOverrideSourceId(null);
    setGroup(null);
    setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const currentChannelId = useMemo(() => {
    if (!isLive) return null;
    return src.meta.id.replace(/^iptv:/, "");
  }, [isLive, src.meta.id]);

  const prevStackRef = useRef<PlayerSrc[]>([]);
  const lastSrcRef = useRef<PlayerSrc | null>(null);
  useEffect(() => {
    if (!isLive) {
      lastSrcRef.current = null;
      return;
    }
    const prev = lastSrcRef.current;
    if (prev && prev.meta.id !== src.meta.id) {
      const stack = prevStackRef.current;
      if (stack[stack.length - 1]?.meta.id !== prev.meta.id) stack.push(prev);
      if (stack.length > 12) stack.shift();
    }
    lastSrcRef.current = src;
  }, [isLive, src]);

  const goPrevChannel = useCallback(() => {
    const stack = prevStackRef.current;
    let prev = stack.pop();
    while (prev && prev.meta.id === lastSrcRef.current?.meta.id) prev = stack.pop();
    if (prev) replacePlayerSrc(prev);
  }, [replacePlayerSrc]);

  const switchChannel = useCallback(
    (channel: IptvChannel, program?: string) => {
      const newMeta: Meta = {
        id: `iptv:${channel.id}`,
        type: "tv",
        name: channel.name,
        poster: channel.logo ?? undefined,
        logo: channel.logo ?? undefined,
        background: channel.logo ?? undefined,
        description: channel.group ? `Live channel: ${channel.group}` : "Live channel",
        releaseInfo: "Live",
      };
      const newSrc: PlayerSrc = {
        meta: newMeta,
        url: channel.url,
        title: channel.name,
        subtitle: channel.group ?? "Live",
        notWebReady: true,
        isLive: true,
        headers: headersFromChannel(channel),
        liveProgram: program,
      };
      replacePlayerSrc(newSrc);
      setOpen(false);
    },
    [replacePlayerSrc],
  );

  return {
    open,
    setOpen,
    isLive,
    activeSource,
    availableSources,
    selectSource,
    currentChannelId,
    switchChannel,
    goPrevChannel,
    group,
    setGroup,
    query,
    setQuery,
  };
}
