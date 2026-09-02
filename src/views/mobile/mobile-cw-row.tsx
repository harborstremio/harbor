import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { useAuth } from "@/lib/auth";
import { anyProfileSharesStremioWith, useProfiles } from "@/lib/profiles";
import { useHideAnime } from "@/lib/anime-hide";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { dismissCw, isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { listLocalCw, subscribeLocalCw, type LocalCwEntry } from "@/lib/local-cw";
import { readSnapshot, useSnapshotVersion } from "@/lib/snapshots";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
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

type Translate = (key: string, vars?: Record<string, string | number>) => string;

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

// listLocalCw() is synchronous while the cloud library is not, so the first
// merge is local-only. Consumers that must not flash a partial list wait on this.
let cwReady = false;
const readySubs = new Set<() => void>();

// The latch is global but items is per mount, so a remount used to arrive with
// ready already true and an empty list, and home rendered the local-only merge
// for a frame before the cloud library landed. Holding the last resolved list
// here means a remount starts correct instead of starting wrong.
let cloudCache: LibraryItem[] = [];
let cloudKey: string | null = null;

function markCwReady(): void {
  if (cwReady) return;
  cwReady = true;
  for (const fn of readySubs) fn();
}

// A different profile has a different library, so the cache cannot answer for
// it and consumers have to wait again rather than show the outgoing profile's.
function resetCwReady(): void {
  if (!cwReady) return;
  cwReady = false;
  for (const fn of readySubs) fn();
}

export function useMobileCwReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      readySubs.add(cb);
      return () => void readySubs.delete(cb);
    },
    () => cwReady,
    () => cwReady,
  );
}

export function useMobileCw(limit = 14): LibraryItem[] {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const { activeProfile, profiles } = useProfiles();
  const hideSharedCw = settings.cwPerProfile && anyProfileSharesStremioWith(activeProfile, profiles);
  const hideAnime = useHideAnime();
  const [items, setItems] = useState<LibraryItem[]>(() =>
    authKey && cloudKey === authKey ? cloudCache : [],
  );
  const [localVersion, setLocalVersion] = useState(0);
  const dismissVersion = useCwDismissVersion();

  useEffect(() => {
    if (!authKey) {
      cloudKey = null;
      cloudCache = [];
      setItems([]);
      markCwReady();
      return;
    }
    if (cloudKey === authKey) setItems(cloudCache);
    else resetCwReady();
    let cancelled = false;
    library(authKey)
      .then((li) => {
        cloudKey = authKey;
        cloudCache = li;
        if (!cancelled) setItems(li);
      })
      .catch(() => {})
      .finally(markCwReady);
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  useEffect(() => subscribeLocalCw(() => setLocalVersion((v) => v + 1)), []);

  return useMemo(() => {
    void localVersion;
    void dismissVersion;
    const base = hideSharedCw ? [] : items.filter((i) => !ANIME_CLOUD_ID.test(i._id));
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
  }, [items, localVersion, dismissVersion, limit, hideAnime, hideSharedCw]);
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
  const t = useT();
  const { settings } = useSettings();
  const { authKey } = useAuth();
  useSnapshotVersion();
  const metas = useMemo(() => items.map(toMeta), [items]);
  const logos = useHeroLogos(metas, settings);

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-4 text-[18px] font-semibold tracking-tight text-ink">
        {t("Continue watching")}
      </h2>
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
  const t = useT();
  const meta = toMeta(item);
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  const progress = dur > 0 ? Math.min(1, off / dur) : 0;
  const external = item.external === "simkl";
  const remaining = dur > 0 && !external ? formatRemaining(dur - off, t) : "";
  const ep = episodeInfo(item);
  const sub =
    item.type !== "movie" && ep
      ? isAnimeCwItem(item)
        ? t("Ep {episode}", { episode: ep.episode })
        : t("S{season} · E{episode}", { season: ep.season, episode: ep.episode })
      : "";
  const bg = downscaleTmdb(readSnapshot(item._id) ?? item.background ?? item.poster);

  return (
    <div className="w-[260px] shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpenDetail(meta)}
          aria-label={t("View {title}", { title: item.name })}
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
              <span className="shrink-0">{remaining || t("Resume")}</span>
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
          aria-label={t("Remove from Continue watching")}
          className="absolute end-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition-transform duration-150 active:scale-90"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onOpenDetail(meta)}
        aria-label={t("View {title}", { title: item.name })}
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

function formatRemaining(ms: number, t: Translate): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return t("{count}m left", { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? t("{count}h left", { count: hours })
    : t("{hours}h {minutes}m left", { hours, minutes: remainder });
}

function downscaleTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w500/");
}
