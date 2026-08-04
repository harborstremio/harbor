import { useEffect, useMemo, useState } from "react";
import { Bookmark, Clock, Star, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import type { RemoteLibraryItem } from "@/lib/remote/protocol";
import { useMobileRemote } from "./mobile-remote";
import { MobileDetail } from "./mobile-detail";

type SectionId = "watchlist" | "history" | "favorites";
type Entry = { meta: Meta; date: number };
type SectionState = { entries: Entry[]; loading: boolean };

const SECTIONS: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
  { id: "watchlist", label: "Watchlist", icon: Bookmark },
  { id: "history", label: "History", icon: Clock },
  { id: "favorites", label: "Favorites", icon: Star },
];

const EMPTY: Record<SectionId, { icon: LucideIcon; title: string; body: string }> = {
  watchlist: {
    icon: Bookmark,
    title: "Your watchlist is empty",
    body: "Save a movie or show from any detail page and it lines up here for later.",
  },
  history: {
    icon: Clock,
    title: "Nothing watched yet",
    body: "Press play on something. It shows up here once you start watching.",
  },
  favorites: {
    icon: Star,
    title: "No favorites yet",
    body: "Tap the star on any movie or show to keep it close.",
  },
};

const TAB_KEY = "harbor.mobile.library.tab";

const VIEW_SWAP_CSS = `
@keyframes ml-view-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ml-view-in { animation: ml-view-in 260ms var(--ease-out) both; }
@media (prefers-reduced-motion: reduce) {
  .ml-view-in { animation: none; }
}
`;

function readSavedTab(): SectionId {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === "watchlist" || v === "history" || v === "favorites") return v;
  } catch {}
  return "watchlist";
}

export function MobileLibrary() {
  const [tab, setTab] = useState<SectionId>(readSavedTab);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);
  const { data, connected } = useLibraryData();

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {}
  }, [tab]);

  const active = data[tab];

  return (
    <div
      className="flex flex-col gap-6 px-5"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
    >
      <style>{VIEW_SWAP_CSS}</style>
      <Header />
      <TabStrip tab={tab} onTab={setTab} />
      <div key={tab} className="ml-view-in">
        <Section state={active} kind={tab} connected={connected} onOpenDetail={setDetailMeta} />
      </div>
      {detailMeta && <MobileDetail meta={detailMeta} onClose={() => setDetailMeta(null)} />}
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-subtle">
        My library
      </span>
      <h1 className="font-display text-[26px] font-medium leading-tight tracking-tight text-ink">
        Your collection
      </h1>
    </div>
  );
}

function TabStrip({ tab, onTab }: { tab: SectionId; onTab: (t: SectionId) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {SECTIONS.map((s) => {
        const on = s.id === tab;
        const Icon = s.icon;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onTab(s.id)}
            aria-current={on ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13.5px] font-semibold transition-colors duration-200 active:scale-[0.97] motion-reduce:transition-none ${
              on ? "bg-ink text-canvas" : "bg-surface text-ink-muted ring-1 ring-edge-soft"
            }`}
          >
            <Icon size={15} strokeWidth={2.3} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  state,
  kind,
  connected,
  onOpenDetail,
}: {
  state: SectionState;
  kind: SectionId;
  connected: boolean;
  onOpenDetail: (m: Meta) => void;
}) {
  if (!connected && state.entries.length === 0) return <NotConnected />;
  if (state.loading && state.entries.length === 0) return <SkeletonGrid />;
  if (state.entries.length === 0) return <Empty kind={kind} />;
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      {state.entries.map((e) => (
        <GridTile key={e.meta.id} meta={e.meta} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  );
}

function GridTile({ meta, onOpenDetail }: { meta: Meta; onOpenDetail: (m: Meta) => void }) {
  const { settings } = useSettings();
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(meta)}
      className="text-start transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
    >
      <Poster
        src={src}
        onError={onError}
        seed={meta.id}
        ratio="portrait"
        lazy
        className="rounded-[12px]"
      />
      {meta.name && (
        <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-ink-muted">
          {meta.name}
        </p>
      )}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div
            className="w-full animate-pulse rounded-[12px] bg-elevated/70"
            style={{ paddingTop: "150%" }}
          />
          <div className="h-3 w-3/4 animate-pulse rounded bg-elevated/60" />
        </div>
      ))}
    </div>
  );
}

function Empty({ kind }: { kind: SectionId }) {
  const cfg = EMPTY[kind];
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center gap-3 pt-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-ink-subtle ring-1 ring-edge-soft">
        <Icon size={24} strokeWidth={1.9} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-ink">{cfg.title}</h2>
        <p className="max-w-[260px] text-[13px] leading-relaxed text-ink-muted">{cfg.body}</p>
      </div>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="flex flex-col items-center gap-3 pt-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-ink-subtle ring-1 ring-edge-soft">
        <WifiOff size={24} strokeWidth={1.9} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-ink">Not connected to a computer</h2>
        <p className="max-w-[260px] text-[13px] leading-relaxed text-ink-muted">
          Your library lives on Harbor. Connect to your computer and it shows up here.
        </p>
      </div>
    </div>
  );
}

function toEntries(items?: RemoteLibraryItem[]): Entry[] {
  return (items ?? []).map((it) => ({
    meta: {
      id: it.id,
      type: it.type as Meta["type"],
      name: it.name ?? "",
      poster: it.poster,
      background: it.background,
    },
    date: 0,
  }));
}

function useLibraryData(): { data: Record<SectionId, SectionState>; connected: boolean } {
  const { connected, snapshot } = useMobileRemote();
  const lib = snapshot.library;
  return useMemo(() => {
    const loading = connected && !lib;
    return {
      connected,
      data: {
        watchlist: { entries: toEntries(lib?.watchlist), loading },
        history: { entries: toEntries(lib?.history), loading },
        favorites: { entries: toEntries(lib?.favorites), loading },
      },
    };
  }, [connected, lib]);
}
