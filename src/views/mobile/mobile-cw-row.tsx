import { useEffect, useMemo, useState } from "react";
import { Play, X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useAuth } from "@/lib/auth";
import { useHideAnime } from "@/lib/anime-hide";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { dismissCw, isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { listLocalCw, subscribeLocalCw, type LocalCwEntry } from "@/lib/local-cw";
import { readSnapshot, useSnapshotVersion } from "@/lib/snapshots";
import { useSettings } from "@/lib/settings";
import {
  ANIME_CLOUD_ID,
  cwSortKey,
  episodeFromVideoId,
  isAnimeCwItem,
  isCwMember,
  library,
  libraryMetaType,
  type LibraryItem,
} from "@/lib/stremio";

function localToLibraryItem(e: LocalCwEntry): LibraryItem {
  return {
    _id: e.id,
    type: e.type,
    name: e.name,
    poster: e.poster,
    background: e.background,
    state: {
      timeOffset: e.positionMs,
      duration: e.durationMs,
      season: e.season,
      episode: e.episode,
      video_id: e.videoId,
      flaggedWatched: e.durationMs > 0 && e.positionMs / e.durationMs >= 0.9 ? 1 : 0,
      lastWatched: new Date(e.t).toISOString(),
    },
    removed: false,
    temp: false,
    _ctime: new Date(e.t).toISOString(),
    _mtime: new Date(e.t).toISOString(),
    local: true,
  };
}

export function useMobileCw(limit = 14): LibraryItem[] {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const cwPerProfile = settings.cwPerProfile;
  const hideAnime = useHideAnime();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [localVersion, setLocalVersion] = useState(0);
  const dismissVersion = useCwDismissVersion();

  useEffect(() => {
    if (!authKey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    library(authKey)
      .then((li) => {
        if (!cancelled) setItems(li);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  useEffect(() => subscribeLocalCw(() => setLocalVersion((v) => v + 1)), []);

  return useMemo(() => {
    void localVersion;
    void dismissVersion;
    const base = cwPerProfile ? [] : items.filter((i) => !ANIME_CLOUD_ID.test(i._id));
    const merged = [...base, ...listLocalCw().map(localToLibraryItem)]
      .filter(
        (i) =>
          (i.type as string) !== "other" &&
          !i._id.startsWith("iptv:") &&
          !isCwDismissed(i) &&
          isCwMember(i) &&
          !(hideAnime && isAnimeCwItem(i)),
      )
      .map((i) => ({ i, k: cwSortKey(i) }))
      .sort((a, b) => b.k - a.k)
      .map((e) => e.i);
    const seen = new Set<string>();
    const out: LibraryItem[] = [];
    for (const i of merged) {
      if (seen.has(i._id)) continue;
      seen.add(i._id);
      out.push(i);
      if (out.length >= limit) break;
    }
    return out;
  }, [items, localVersion, dismissVersion, limit, hideAnime, cwPerProfile]);
}

function toMeta(item: LibraryItem): Meta {
  return {
    id: item._id,
    type: libraryMetaType(item.type),
    name: item.name,
    poster: item.poster,
    background: item.background,
  };
}

export function MobileCwRow({
  items,
  onOpenDetail,
}: {
  items: LibraryItem[];
  onOpenDetail: (m: Meta) => void;
}) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  useSnapshotVersion();
  const metas = useMemo(() => items.map(toMeta), [items]);
  const logos = useHeroLogos(metas, settings);

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-4 text-[18px] font-semibold tracking-tight text-ink">Continue watching</h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <MobileCwCard
            key={item._id}
            item={item}
            logo={logos[item._id]}
            onOpenDetail={onOpenDetail}
            onDismiss={() => dismissCw(item, authKey)}
          />
        ))}
      </div>
    </section>
  );
}

function MobileCwCard({
  item,
  logo,
  onOpenDetail,
  onDismiss,
}: {
  item: LibraryItem;
  logo?: string;
  onOpenDetail: (m: Meta) => void;
  onDismiss: () => void;
}) {
  const meta = toMeta(item);
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  const progress = dur > 0 ? Math.min(1, off / dur) : 0;
  const external = item.external === "simkl";
  const remaining = dur > 0 && !external ? formatRemaining(dur - off) : "";
  const ep = episodeInfo(item);
  const sub =
    item.type !== "movie" && ep
      ? isAnimeCwItem(item)
        ? `Ep ${ep.episode}`
        : `S${ep.season} · E${ep.episode}`
      : "";
  const bg = downscaleTmdb(readSnapshot(item._id) ?? item.background ?? item.poster);

  return (
    <div className="w-[260px] shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpenDetail(meta)}
          className="relative block aspect-[16/9] w-full overflow-hidden rounded-[16px] bg-surface text-start ring-1 ring-edge-soft/50 transition-transform duration-150 active:scale-[0.97]"
        >
          {bg && (
            <img
              src={bg}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover brightness-90"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/15" />
          {logo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 pb-7">
              <img
                src={logo}
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-[50%] w-auto max-w-[76%] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
              />
            </div>
          )}
          <span className="absolute bottom-2.5 start-2.5 flex max-w-[calc(100%-20px)] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Play size={11} strokeWidth={0} fill="currentColor" className="shrink-0" />
            {sub ? (
              <>
                <span className="shrink-0">{sub}</span>
                {remaining && (
                  <>
                    <span className="text-white/45">{"·"}</span>
                    <span className="shrink-0 text-white/80">{remaining}</span>
                  </>
                )}
              </>
            ) : (
              <span className="shrink-0">{remaining || "Resume"}</span>
            )}
          </span>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
            <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Remove from Continue watching"
          className="absolute end-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition-transform duration-150 active:scale-90"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(meta)}
        className="mt-1.5 line-clamp-1 w-full text-start text-[13px] font-medium text-ink-muted"
      >
        {item.name}
      </button>
    </div>
  );
}

function episodeInfo(i: LibraryItem): { season: number; episode: number } | null {
  if (i.type === "movie") return null;
  const s = i.state?.season;
  const e = i.state?.episode;
  if (s && e) return { season: s, episode: e };
  const vid = i.state?.video_id ?? "";
  if (/^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3) {
    const num = Number(vid.split(":")[2]);
    return Number.isFinite(num) && num > 0 ? { season: 1, episode: num } : null;
  }
  const parsed = episodeFromVideoId(vid);
  return parsed && parsed.episode > 0 ? parsed : null;
}

function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
}

function downscaleTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w500/");
}
