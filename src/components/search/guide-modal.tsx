import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvChannel, IptvPlaylistSource } from "@/lib/iptv/types";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { useEpg, useNowTick } from "@/views/live/hooks/use-epg";
import { useIptvPlaylist } from "@/views/live/hooks/use-iptv-playlist";
import { GuideView } from "@/views/live/guide/guide-view";

function synthChannelMeta(ch: IptvChannel): Meta {
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

export function GuideModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const { openPlayer } = useView();
  const m3uSources = useMemo(
    () => settings.iptvPlaylists.filter((p) => (p.kind ?? "m3u") !== "epg"),
    [settings.iptvPlaylists],
  );
  const [sourceId, setSourceId] = useState<string | null>(() => m3uSources[0]?.id ?? null);
  const source: IptvPlaylistSource | null = useMemo(() => {
    if (!sourceId) return null;
    const found = m3uSources.find((s) => s.id === sourceId);
    return found ? { id: found.id, name: found.name, url: found.url, epgUrl: found.epgUrl } : null;
  }, [sourceId, m3uSources]);

  const { state } = useIptvPlaylist(source);
  const playlist = state.kind === "ready" ? state.playlist : getCachedPlaylist(source?.id ?? "");
  const { index: epg } = useEpg(source);
  const nowMs = useNowTick(30_000);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onPlay = (ch: IptvChannel) => {
    openPlayer({
      meta: synthChannelMeta(ch),
      url: ch.url,
      title: ch.name,
      subtitle: ch.group ?? "Live",
      notWebReady: true,
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[260] flex flex-col bg-canvas/95 backdrop-blur-xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-edge-soft/40 px-8 py-5">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
            {t("TV Guide")}
          </h2>
          {m3uSources.length > 1 && (
            <select
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(e.target.value || null)}
              className="h-9 rounded-lg border border-edge-soft bg-elevated px-3 text-[13px] text-ink focus:border-edge focus:outline-none"
            >
              {m3uSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-elevated/70 ps-3 pe-4 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={14} strokeWidth={2.4} />
          Close
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
        {!source && (
          <EmptyMessage
            title="No Live TV playlists yet"
            body="Add an M3U or Xtream playlist in Settings → Live TV to use the guide."
          />
        )}
        {source && !playlist && (
          <div className="flex flex-1 items-center justify-center text-ink-subtle">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {source && playlist && playlist.channels.length === 0 && (
          <EmptyMessage
            title="No channels"
            body="This playlist hasn't been loaded yet, or it has no channels."
          />
        )}
        {source && playlist && playlist.channels.length > 0 && (
          <GuideView
            channels={playlist.channels}
            epg={epg}
            nowMs={nowMs}
            onPlay={onPlay}
            resetKey={source.id}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <span className="text-[16px] font-semibold text-ink">{title}</span>
      <p className="max-w-md text-[13.5px] text-ink-muted">{body}</p>
    </div>
  );
}
