import { ChevronDown, ChevronUp, Grid2x2, Info, Square, StopCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMultiviewStore, type Layout } from "@/lib/multiview/store";
import type { EpgIndex, IptvChannel, IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { Grid } from "./multiview/grid";
import { ChannelPicker } from "./multiview/channel-picker";
import { pushActivityHint } from "@/lib/discord/activity-hint";

const LAYOUTS: { id: Layout; label: string }[] = [
  { id: "1", label: "Single" },
  { id: "2", label: "Side by side" },
  { id: "3", label: "Triple" },
  { id: "2x2", label: "Quad" },
];

export function MultiviewView({
  channels,
  epg,
  active,
  sources,
  playlists,
  loading,
}: {
  channels: IptvChannel[];
  epg: EpgIndex | null;
  active: boolean;
  sources: IptvPlaylistSource[];
  playlists: Map<string, IptvPlaylist>;
  loading: boolean;
}) {
  const store = useMultiviewStore();
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(() => {
    try {
      return localStorage.getItem("harbor.multiview.banner-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const dismissBanner = () => {
    setBannerHidden(true);
    try {
      localStorage.setItem("harbor.multiview.banner-dismissed", "1");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("harbor:immersive", { detail: collapsed }));
  }, [collapsed]);

  useEffect(() => {
    if (!active) return;
    const n = store.slots.filter(Boolean).length;
    const label =
      n > 0 ? `Watching ${n} stream${n === 1 ? "" : "s"} at once` : "Setting up Multiview";
    return pushActivityHint({ details: label, state: "Multiview" });
  }, [active, store.slots]);

  useEffect(
    () => () => {
      window.dispatchEvent(new CustomEvent("harbor:immersive", { detail: false }));
    },
    [],
  );

  useEffect(() => {
    if (!collapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCollapsed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed]);

  useEffect(() => {
    if (active) return;
    store.reset();
  }, [active, store]);

  const closeSlot = (slot: number) => {
    store.setSlot(slot, null);
    if (store.audioFocus === slot) {
      const next = store.slots.findIndex((c, i) => i !== slot && c != null);
      store.setAudioFocus(next < 0 ? 0 : next);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex shrink-0 items-center gap-2 px-6 ${collapsed ? "py-1" : "pb-3 pt-1"}`}>
        {!collapsed && (
          <>
            <div className="flex items-center gap-1 rounded-xl border border-edge-soft/55 bg-elevated p-1">
              {LAYOUTS.map((l) => {
                const isActive = store.layout === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => store.setLayout(l.id)}
                    title={l.label}
                    className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${
                      isActive ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {l.id === "2x2" ? <Grid2x2 size={13} /> : <Square size={12} />}
                    {l.id === "2x2" ? "2x2" : l.id}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => store.reset()}
              className="flex h-9 items-center gap-2 rounded-xl border border-edge-soft/55 px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
            >
              <StopCircle size={15} />
              Clear all
            </button>
          </>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Show controls" : "Hide controls, full grid"}
          aria-label={collapsed ? "Show controls" : "Hide controls"}
          className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!collapsed && !bannerHidden && (
        <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-edge-soft/60 bg-elevated/30 px-3.5 py-2.5">
          <Info size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-subtle" />
          <p className="flex-1 text-[11.5px] leading-relaxed text-ink-muted">
            Most IPTV providers cap simultaneous streams per account (commonly 1–2). If a tile drops
            to "Stream offline" while others play, your provider may be throttling. Try closing a
            stream and retrying.
          </p>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={12} strokeWidth={2.4} />
          </button>
        </div>
      )}

      <div className={`min-h-0 flex-1 px-6 ${collapsed ? "pb-3" : "pb-6"}`}>
        <Grid
          layout={store.layout}
          slots={store.slots}
          focusIndex={store.audioFocus}
          onPick={(s) => setPickerSlot(s)}
          onClose={closeSlot}
          onFocus={(s) => store.setAudioFocus(s)}
          onMute={() => store.setAudioFocus(-1)}
        />
      </div>

      {pickerSlot != null && (
        <ChannelPicker
          slot={pickerSlot}
          channels={channels}
          epg={epg}
          sources={sources}
          playlists={playlists}
          loading={loading}
          onClose={() => setPickerSlot(null)}
          onPick={(ch) => {
            const wasEmpty = store.slots.every((c) => c == null);
            store.setSlot(pickerSlot, ch);
            if (wasEmpty) store.setAudioFocus(pickerSlot);
            setPickerSlot(null);
          }}
        />
      )}
    </div>
  );
}
