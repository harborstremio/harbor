import { Bookmark, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Poster, usePosterChain } from "@/components/poster";
import { hasEmbeddedStreams, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useInWatchlist } from "@/lib/watchlist";
import { useT } from "@/lib/i18n";
import { hydrateLibraryMeta } from "./hydrate-meta";

export function WatchlistCard({ meta, onRemove }: { meta: Meta; onRemove?: () => void }) {
  const t = useT();
  const { openMeta } = useView();
  const { settings } = useSettings();
  const inList = useInWatchlist(meta.id);
  const cardRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState<Meta | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const posterFailedOnceRef = useRef(false);
  useEffect(() => {
    posterFailedOnceRef.current = false;
    setPosterFailed(false);
  }, [meta.id]);
  const onPosterError = useCallback(() => {
    if (posterFailedOnceRef.current) return;
    posterFailedOnceRef.current = true;
    setPosterFailed(true);
  }, []);
  useEffect(() => {
    const needsAddonHydration = !!meta.addonOrigin && !hasEmbeddedStreams(meta.videos);
    if (meta.poster && meta.name && !posterFailed && !needsAddonHydration) {
      setHydrated(null);
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    const run = () => {
      hydrateLibraryMeta(
        meta.id,
        narrowMediaType(meta.type),
        settings.tmdbKey ?? null,
        meta.addonOrigin,
      )
        .then((full) => {
          if (cancelled || !full) return;
          setHydrated(full);
        })
        .catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [
    meta.id,
    meta.type,
    meta.poster,
    meta.name,
    settings.tmdbKey,
    posterFailed,
    meta.addonOrigin?.id,
    meta.addonOrigin?.base,
    meta.videos?.length,
  ]);
  const display: Meta = hydrated
    ? {
        ...meta,
        ...hydrated,
        id: meta.id,
        type: meta.type,
        addonOrigin: meta.addonOrigin ?? hydrated.addonOrigin,
        videos: hydrated.videos ?? meta.videos,
      }
    : meta;
  const open = () => openMeta(display);
  const poster = usePosterChain(
    settings.rpdbKey,
    display.id,
    display.poster,
    display.type === "series" ? "series" : "movie",
  );
  return (
    <div
      ref={cardRef}
      className="group relative flex flex-col gap-2 text-start"
      onMouseLeave={() => setConfirm(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] outline-none ring-offset-2 ring-offset-canvas transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-ink group-hover:scale-[1.02]"
      >
        <Poster
          src={poster.src}
          seed={display.id}
          className="h-full w-full"
          onError={() => {
            poster.onError();
            onPosterError();
          }}
        />
        {inList && (
          <span className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-canvas backdrop-blur-sm">
            <Bookmark size={12} strokeWidth={2.6} fill="currentColor" />
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm) {
                onRemove();
                setConfirm(false);
              } else {
                setConfirm(true);
              }
            }}
            className={`absolute end-2 top-2 flex h-7 items-center justify-center gap-1 rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-200 ${
              confirm
                ? "bg-danger px-2.5 text-[11px] font-semibold"
                : "w-7 bg-canvas/70 opacity-0 backdrop-blur-sm hover:bg-canvas/90 group-hover:opacity-100"
            }`}
            aria-label={confirm ? t("Confirm remove from library") : t("Remove from library")}
          >
            <Trash2 size={12} strokeWidth={2.2} />
            {confirm && t("Remove")}
          </button>
        )}
      </div>
      <button type="button" onClick={open} className="text-start">
        <p className="truncate text-[13px] font-medium text-ink transition-colors hover:text-accent">
          {display.name || meta.id}
        </p>
        {display.releaseInfo && (
          <p className="-mt-1.5 truncate text-[11.5px] text-ink-subtle">{display.releaseInfo}</p>
        )}
      </button>
    </div>
  );
}
