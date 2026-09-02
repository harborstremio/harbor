import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { harborImdbTitle, harborImdbTitleCached } from "@/lib/providers/harbor-imdb";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { usePosterChain } from "@/components/poster";

export function PortCard({
  meta,
  onClick,
  index = 0,
  state = "heading",
}: {
  meta: Meta;
  onClick?: () => void;
  index?: number;
  state?: "heading" | "done" | "current";
}) {
  const { settings } = useSettings();
  const poster = usePosterChain(settings.rpdbKey, meta.id, meta.poster, meta.type === "series" ? "series" : "movie");
  const passive = state !== "heading";
  const [rating, setRating] = useState<string | undefined>(meta.imdbRating);
  useEffect(() => {
    const tt = meta.id.startsWith("tt") ? meta.id : null;
    if (!tt) {
      setRating(meta.imdbRating);
      return;
    }
    const cached = harborImdbTitleCached(tt);
    if (cached !== undefined) {
      setRating(cached != null ? cached.toFixed(1) : meta.imdbRating);
      return;
    }
    setRating(meta.imdbRating);
    let cancelled = false;
    harborImdbTitle(tt)
      .then((r) => {
        if (!cancelled && r != null) setRating(r.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.imdbRating]);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms`, animationDuration: "420ms", animationFillMode: "both" }}
      className="group flex w-full flex-col gap-2.5 text-start [transform-origin:center_bottom] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 active:scale-[0.97]"
    >
      <span
        className={`relative block aspect-[2/3] overflow-hidden rounded-md ring-1 ring-edge-soft transition-[transform,box-shadow,border-color] duration-200 ease-out group-hover:will-change-transform ${
          passive
            ? "opacity-55"
            : "group-hover:-translate-y-1 group-hover:ring-edge group-hover:shadow-[0_26px_50px_-20px_rgba(0,0,0,0.7)] motion-reduce:group-hover:translate-y-0"
        }`}
      >
        <img
          src={poster.src}
          onError={poster.onError}
          alt=""
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-[520ms] ease-out [transition-delay:90ms] motion-safe:group-hover:will-change-transform motion-safe:group-hover:scale-[1.06] motion-reduce:transition-none"
        />
        {!passive && (
          <>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              style={{ background: "linear-gradient(to top, var(--color-canvas), transparent)" }}
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-2 text-[10.5px] font-semibold text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {meta.releaseInfo && <span className="tabular-nums text-ink-muted">{meta.releaseInfo}</span>}
              {rating && (
                <span className="flex items-center gap-1">
                  <ImdbIcon className="h-[11px] w-auto rounded-[2px]" />
                  <span className="tabular-nums">{rating}</span>
                </span>
              )}
            </span>
          </>
        )}
      </span>
      <span className="line-clamp-1 text-[12.5px] font-medium text-ink-muted transition-colors group-hover:text-ink">{meta.name}</span>
    </button>
  );
}
