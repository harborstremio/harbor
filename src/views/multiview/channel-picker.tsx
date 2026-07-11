import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import { useFavorites } from "@/lib/iptv/favorites";
import type { EpgIndex, IptvChannel, IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { findCurrent } from "@/lib/iptv/xmltv";
import type { SlotChannel } from "@/lib/multiview/store";
import { ChannelCard } from "@/views/live/channel-card";
import { ChevronDown, Link2, Loader2, Search, Star, Tv, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const ALL = "__ALL__";
const FAVS = "__FAVS__";
const ALL_PLAYLISTS = "__ALL_PLAYLISTS__";
const RENDER_CAP = 240;

export function ChannelPicker({
  slot,
  channels,
  epg,
  sources,
  playlists,
  loading,
  onPick,
  onClose,
}: {
  slot: number;
  channels: IptvChannel[];
  epg: EpgIndex | null;
  sources: IptvPlaylistSource[];
  playlists: Map<string, IptvPlaylist>;
  loading: boolean;
  onPick: (ch: SlotChannel) => void;
  onClose: () => void;
}) {
  const favorites = useFavorites();
  const [q, setQ] = useState("");
  const [groupKey, setGroupKey] = useState<string>(ALL);
  const [playlistId, setPlaylistId] = useState<string>(ALL_PLAYLISTS);
  const [manual, setManual] = useState("");
  const now = Date.now();

  const scopedChannels = useMemo<IptvChannel[]>(() => {
    if (playlistId === ALL_PLAYLISTS) return channels;
    const pl = playlists.get(playlistId);
    return pl?.channels ?? [];
  }, [playlistId, channels, playlists]);

  const tvgIdCounts = useMemo(() => computeTvgIdCounts(scopedChannels), [scopedChannels]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of scopedChannels) {
      const g = c.group;
      if (g && !seen.has(g)) {
        seen.add(g);
        out.push(g);
      }
    }
    return out;
  }, [scopedChannels]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scopedChannels.filter((c) => {
      if (groupKey === FAVS && !favorites.has(c.id)) return false;
      if (groupKey !== ALL && groupKey !== FAVS && c.group !== groupKey) return false;
      if (s && !c.name.toLowerCase().includes(s) && !(c.group ?? "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [scopedChannels, q, groupKey, favorites]);

  const shown = filtered.slice(0, RENDER_CAP);

  const submitManual = () => {
    const v = manual.trim();
    if (!/^https?:\/\//i.test(v)) return;
    onPick({ name: "Custom stream", url: v });
  };

  const showLoading = loading && scopedChannels.length === 0;

  return (
    <div className="fixed inset-0 z-[300] flex animate-[mvpicker-in_180ms_ease-out] flex-col bg-canvas">
      <style>{MVPICKER_KEYFRAMES}</style>
      <header className="flex shrink-0 items-center gap-3 border-b border-edge-soft/60 px-7 py-4">
        <span className="font-display text-[18px] font-medium tracking-tight text-ink">Add to tile {slot + 1}</span>
        {sources.length > 1 && (
          <PlaylistDropdown sources={sources} playlists={playlists} value={playlistId} onChange={setPlaylistId} />
        )}
        <div className="flex h-11 min-w-[260px] flex-1 items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-4">
          <Search size={15} strokeWidth={2} className="text-ink-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              showLoading ? "Loading channels…" : `Search ${scopedChannels.length.toLocaleString()} channels`
            }
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle/60"
          />
          {showLoading && <Loader2 size={14} className="animate-spin text-ink-subtle" />}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-e border-edge-soft/40 p-3">
          {showLoading ? (
            <RailSkeleton />
          ) : (
            <>
              <RailItem
                k={FAVS}
                label="★ Favorites"
                count={favorites.count}
                active={groupKey === FAVS}
                onClick={() => setGroupKey(FAVS)}
              />
              <RailItem
                k={ALL}
                label="All channels"
                count={scopedChannels.length}
                active={groupKey === ALL}
                onClick={() => setGroupKey(ALL)}
              />
              <div className="my-2 h-px bg-edge-soft/40" />
              {groups.map((g) => (
                <RailItem key={g} k={g} label={g} active={groupKey === g} onClick={() => setGroupKey(g)} />
              ))}
            </>
          )}
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {showLoading ? (
            <CardGridSkeleton />
          ) : shown.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
              {groupKey === FAVS ? (
                <>
                  <Star size={26} className="text-ink-subtle" />
                  <p className="text-[13.5px]">No favorites yet. Star channels to pin them here.</p>
                </>
              ) : (
                <>
                  <Tv size={26} className="text-ink-subtle" />
                  <p className="text-[13.5px]">No channels match. Try another group or paste a URL.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {shown.map((ch) => {
                  const programs = epgProgramsForChannel(ch, epg, tvgIdCounts);
                  const { current } = findCurrent(programs, now);
                  return (
                    <ChannelCard
                      key={`${ch.id}-${ch.url}`}
                      channel={ch}
                      current={current}
                      now={now}
                      onPlay={(c) => onPick({ name: c.name, url: c.url })}
                    />
                  );
                })}
              </div>
              {filtered.length > RENDER_CAP && (
                <p className="mt-6 text-center text-[12.5px] text-ink-subtle">
                  Showing {RENDER_CAP} of {filtered.length}. Refine the search to see more.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-edge-soft/60 px-7 py-3">
        <Link2 size={15} className="shrink-0 text-ink-subtle" />
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitManual()}
          placeholder="Or paste a stream URL"
          spellCheck={false}
          className="h-9 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-subtle/60"
        />
        <button
          onClick={submitManual}
          disabled={!/^https?:\/\//i.test(manual.trim())}
          className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </footer>
    </div>
  );
}

function RailItem({
  label,
  count,
  active,
  onClick,
}: {
  k: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13px] transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-elevated hover:text-ink"
      }`}
    >
      <span className="truncate">{label}</span>
      {count != null && (
        <span
          className={`ms-auto shrink-0 rounded-full px-1.5 py-px text-[10.5px] tabular-nums ${
            active ? "bg-canvas/15 text-canvas" : "bg-edge/60 text-ink-subtle"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function PlaylistDropdown({
  sources,
  playlists,
  value,
  onChange,
}: {
  sources: IptvPlaylistSource[];
  playlists: Map<string, IptvPlaylist>;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const activeLabel =
    value === ALL_PLAYLISTS ? "All playlists" : (sources.find((s) => s.id === value)?.name ?? "Playlist");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft/55 bg-elevated px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-raised"
      >
        <span className="max-w-[160px] truncate">{activeLabel}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute start-0 top-[calc(100%+6px)] z-[310] w-[240px] overflow-hidden rounded-xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
          <PlaylistOption
            label="All playlists"
            sub={`${sumChannels(playlists)} channels`}
            active={value === ALL_PLAYLISTS}
            onClick={() => {
              onChange(ALL_PLAYLISTS);
              setOpen(false);
            }}
          />
          <div className="my-0.5 mx-2 h-px bg-edge-soft/60" />
          {sources.map((s) => {
            const pl = playlists.get(s.id);
            return (
              <PlaylistOption
                key={s.id}
                label={s.name}
                sub={pl ? `${pl.channels.length.toLocaleString()} channels` : "Loading…"}
                active={value === s.id}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlaylistOption({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-start transition-colors ${
        active ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      <span className="truncate text-[13px] font-medium">{label}</span>
      <span className="text-[11px] text-ink-subtle">{sub}</span>
    </button>
  );
}

function sumChannels(playlists: Map<string, IptvPlaylist>): string {
  let total = 0;
  for (const p of playlists.values()) total += p.channels.length;
  return total.toLocaleString();
}

function RailSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-[mvshimmer_1.2s_ease-in-out_infinite] rounded-lg bg-elevated/60"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-[mvshimmer_1.2s_ease-in-out_infinite] flex-col gap-2"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="aspect-video w-full rounded-xl bg-elevated/60" />
          <div className="h-3 w-3/4 rounded bg-elevated/60" />
          <div className="h-2.5 w-1/2 rounded bg-elevated/40" />
        </div>
      ))}
    </div>
  );
}

const MVPICKER_KEYFRAMES = `
@keyframes mvpicker-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes mvshimmer {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.9; }
}
`;
