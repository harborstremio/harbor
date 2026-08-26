import { memo, useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { sizeImageUrl } from "@/lib/img-size";
import { useContextMenu } from "@/lib/context-menu";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { usePosterChain } from "@/components/poster";
import { mergePreferredMeta } from "@/lib/preferred-meta";
import { usePreferredMeta } from "@/lib/use-preferred-meta";

const POS = {
  center: "inset-0 items-center justify-center text-center",
  bottomStart: "inset-x-0 bottom-0 items-end justify-start p-3.5 text-start",
  bottomEnd: "inset-x-0 bottom-0 items-end justify-end p-3.5 text-end",
} as const;

function useLogo(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const [logo, setLogo] = useState<string | undefined>(() => peekCachedLogo(settings.tmdbKey, meta));
  useEffect(() => {
    let cancelled = false;
    const cached = peekCachedLogo(settings.tmdbKey, meta);
    if (cached) {
      setLogo(cached);
      return;
    }
    setLogo(undefined);
    resolveLogo(settings.tmdbKey, meta)
      .then((url) => {
        if (!cancelled) setLogo(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta, settings.tmdbKey]);
  return logo;
}

export const TvCard = memo(function TvCard({ meta, kids = false }: { meta: Meta; kids?: boolean }) {
  const { openMeta, openManga } = useView();
  const { open: openContextMenu } = useContextMenu();
  const { settings } = useSettings();
  const preferredMeta = usePreferredMeta(meta);
  const displayMeta = useMemo(() => mergePreferredMeta(meta, preferredMeta), [meta, preferredMeta]);
  const logo = useLogo(displayMeta);
  const poster = usePosterChain(settings.rpdbKey, meta.id, meta.poster, meta.type === "series" ? "series" : "movie");
  const [artFailed, setArtFailed] = useState(false);
  const wide = !artFailed && meta.background && meta.background !== meta.poster ? meta.background : undefined;
  const pos = POS[settings.tvCardLogoPos] ?? POS.bottomStart;

  const open = () => {
    if (meta.type === "manga") {
      openManga(meta.id);
      return;
    }
    openMeta(displayMeta);
  };

  return (
    <button
      type="button"
      onClick={open}
      onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta: displayMeta })}
      title={displayMeta.name}
      className="group relative block aspect-[16/9] w-full overflow-hidden rounded-[16px] bg-elevated ring-1 ring-edge-soft transition-[box-shadow,--tw-ring-color] duration-200 ease-out hover:ring-edge hover:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
    >
      {wide ? (
        <img
          src={sizeImageUrl(wide, 640)}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setArtFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <img
          src={poster.src}
          onError={poster.onError}
          alt=""
          draggable={false}
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-[18px] saturate-[1.2]"
        />
      )}

      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            settings.tvCardLogoPos === "center"
              ? "linear-gradient(0deg, color-mix(in oklch, var(--color-canvas), transparent 20%) 0%, color-mix(in oklch, var(--color-canvas), transparent 55%) 50%, color-mix(in oklch, var(--color-canvas), transparent 30%) 100%)"
              : "linear-gradient(0deg, var(--color-canvas) 2%, color-mix(in oklch, var(--color-canvas), transparent 35%) 34%, color-mix(in oklch, var(--color-canvas), transparent 82%) 62%, transparent 84%)",
        }}
      />

      <span className={`absolute z-10 flex gap-2.5 ${pos}`}>
        <span className="h-[54px] w-[36px] shrink-0 overflow-hidden rounded-[6px] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)] ring-1 ring-white/12">
          <img src={poster.src} onError={poster.onError} alt="" draggable={false} className="h-full w-full object-cover" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-end gap-1">
          {logo ? (
            <img
              src={logo}
              alt={displayMeta.name}
              draggable={false}
              loading="lazy"
              className="max-h-[34px] w-auto max-w-full self-start object-contain object-left [filter:drop-shadow(0_2px_8px_rgba(0,0,0,0.8))]"
            />
          ) : (
            <span className="line-clamp-2 text-[14.5px] font-semibold leading-tight text-ink [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
              {displayMeta.name}
            </span>
          )}
          {!kids && meta.releaseInfo && (
            <span className="text-[11px] tabular-nums text-ink-muted [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
              {meta.releaseInfo}
            </span>
          )}
        </span>
      </span>
    </button>
  );
});
