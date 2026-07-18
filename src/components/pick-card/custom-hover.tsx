import { Play, Star } from "lucide-react";
import type { CSSProperties } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { CustomHoverConfig } from "@/lib/custom-hover";
import { useT } from "@/lib/i18n";

export function customHoverPosterProps(
  config: CustomHoverConfig,
  preview?: boolean,
): { className: string; style: CSSProperties } {
  const cls = [preview ? "harbor-custom-hover-preview" : "harbor-custom-hover"];
  if (config.scale > 100 || config.blur > 0 || config.dim > 0) cls.push("overflow-hidden");
  if (config.glow) cls.push("ch-glow");
  const style = {
    "--ch-scale": String(config.scale / 100),
    "--ch-blur": `${config.blur}px`,
    "--ch-dim": String(Math.max(0, 1 - config.dim / 100)),
  } as CSSProperties;
  return { className: cls.join(" "), style };
}

export function CustomHoverOverlay({
  config,
  meta,
  onPlay,
  preview,
}: {
  config: CustomHoverConfig;
  meta: Meta;
  onPlay: () => void;
  preview?: boolean;
}) {
  const t = useT();
  const btn = preview ? "pointer-events-none" : "pointer-events-auto";
  const vis = preview
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  const info = (config.showTitle || config.showMeta) && (
    <div className="flex min-w-0 flex-col gap-1">
      {config.showTitle && (
        <span className="line-clamp-1 text-[13px] font-semibold text-white">{meta.name}</span>
      )}
      {config.showMeta && (
        <span className="flex items-center gap-2 text-[11px] text-white/85">
          {meta.imdbRating && (
            <span className="flex items-center gap-0.5">
              <Star size={9} className="fill-amber-400 text-amber-400" />
              {meta.imdbRating}
            </span>
          )}
          {meta.releaseInfo && <span className="text-white/65">{meta.releaseInfo}</span>}
        </span>
      )}
    </div>
  );

  const playDisc = config.showPlay && (
    <span
      role="button"
      aria-label={t("Play")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPlay();
      }}
      className={`${btn} flex h-10 w-10 items-center justify-center rounded-full bg-[#22a45d] text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)] transition-transform hover:scale-110`}
    >
      <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
    </span>
  );

  if (config.overlay === "panel") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 overflow-hidden rounded-b-[var(--poster-radius,12px)]">
        <div
          className={`flex items-end justify-between gap-2 border-t border-white/15 bg-black/35 px-3 pb-3 pt-2.5 backdrop-blur-md transition-[transform,opacity] duration-300 ${
            preview
              ? "translate-y-0 opacity-100"
              : "translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
          }`}
        >
          {info || <span />}
          {playDisc}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-end rounded-[var(--poster-radius,12px)] p-3 transition-opacity duration-300 ${
        config.overlay === "gradient"
          ? "bg-gradient-to-t from-black/85 via-black/20 to-transparent pt-9"
          : ""
      } ${vis}`}
    >
      {info}
      {playDisc && (
        <div className="absolute inset-0 flex items-center justify-center">{playDisc}</div>
      )}
    </div>
  );
}
