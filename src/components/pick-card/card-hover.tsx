import { Star } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { ElegantHoverActions } from "./elegant-hover";

export type CardHoverStyle = "none" | "default" | "marquee" | "elegant" | "frosted" | "cinema" | "spotlight" | "custom";

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export function cardHoverPosterClass(style: CardHoverStyle, preview?: boolean): string {
  if (preview) {
    switch (style) {
      case "elegant":
        return "overflow-hidden [&_img]:scale-110 [&_img]:blur-[8px]";
      case "cinema":
        return "overflow-hidden [&_img]:scale-[1.12]";
      case "frosted":
        return "overflow-hidden [&_img]:scale-[1.04]";
      default:
        return "";
    }
  }
  switch (style) {
    case "elegant":
      return "overflow-hidden [&_img]:transition-[filter,transform] [&_img]:duration-200 group-hover:[&_img]:scale-110 group-hover:[&_img]:blur-[10px]";
    case "cinema":
      return "overflow-hidden [&_img]:transition-transform [&_img]:duration-[1600ms] [&_img]:ease-out group-hover:[&_img]:scale-[1.14]";
    case "frosted":
      return "overflow-hidden [&_img]:transition-transform [&_img]:duration-500 group-hover:[&_img]:scale-[1.04]";
    case "spotlight":
      return "transition-[box-shadow,transform] duration-300 group-hover:ring-2 group-hover:ring-[rgba(242,196,102,0.7)] group-hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6),0_0_34px_-6px_rgba(242,196,102,0.55)]";
    default:
      return "";
  }
}

export function CardHoverOverlay({
  meta,
  style,
  onPlay,
  preview,
}: {
  meta: Meta;
  style: CardHoverStyle;
  onPlay: () => void;
  preview?: boolean;
}) {
  if (style === "elegant") return <ElegantHoverActions meta={meta} onPlay={onPlay} preview={preview} />;
  if (style === "frosted") return <FrostedOverlay meta={meta} onPlay={onPlay} preview={preview} />;
  if (style === "cinema") return <CinemaOverlay onPlay={onPlay} preview={preview} />;
  if (style === "spotlight") return <SpotlightOverlay meta={meta} preview={preview} />;
  return null;
}

function ratingLine(meta: Meta) {
  return (
    <span className="flex items-center gap-2 text-[11px] font-medium text-white/85">
      {meta.imdbRating && (
        <span className="flex items-center gap-0.5">
          <Star size={9} className="fill-amber-400 text-amber-400" />
          {meta.imdbRating}
        </span>
      )}
      {meta.releaseInfo && <span className="text-white/65">{meta.releaseInfo}</span>}
    </span>
  );
}

function playHandler(onPlay: () => void) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPlay();
  };
}

function FrostedOverlay({ meta, onPlay, preview }: { meta: Meta; onPlay: () => void; preview?: boolean }) {
  const t = useT();
  const btn = preview ? "pointer-events-none" : "pointer-events-auto";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 overflow-hidden rounded-b-[var(--poster-radius,12px)]">
      <div
        className={`flex flex-col gap-2 border-t border-white/15 bg-black/35 px-3 pb-3 pt-2.5 backdrop-blur-md transition-[transform,opacity] duration-300 ${EASE} ${
          preview
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        }`}
      >
        <span className="line-clamp-1 text-[13px] font-semibold text-white">{meta.name}</span>
        <div className="flex items-center justify-between gap-2">
          {ratingLine(meta)}
          <span
            role="button"
            aria-label={t("Play")}
            title={t("Play")}
            onClick={playHandler(onPlay)}
            className={`${btn} flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-bold text-black transition-transform hover:scale-105`}
          >
            <Play size={12} fill="currentColor" strokeWidth={0} />
            {t("Play")}
          </span>
        </div>
      </div>
    </div>
  );
}

function CinemaOverlay({ onPlay, preview }: { onPlay: () => void; preview?: boolean }) {
  const t = useT();
  const btn = preview ? "pointer-events-none" : "pointer-events-auto";
  const vis = preview ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";
  const pop = preview
    ? "scale-100 opacity-100"
    : "scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[var(--poster-radius,12px)]">
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgba(0,0,0,0.62))] transition-opacity duration-300 ${vis}`}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${vis}`}
      />
      <span
        role="button"
        aria-label={t("Play")}
        title={t("Play")}
        onClick={playHandler(onPlay)}
        className={`${btn} relative flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/40 backdrop-blur-md transition-[transform,opacity] duration-300 ${EASE} hover:bg-white/20 ${pop}`}
      >
        <Play size={19} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
      </span>
    </div>
  );
}

function SpotlightOverlay({ meta, preview }: { meta: Meta; preview?: boolean }) {
  const vis = preview ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 z-20 rounded-[var(--poster-radius,12px)] transition-opacity duration-300 ${vis}`}
        style={{ boxShadow: "inset 0 0 0 2px rgba(242,196,102,0.85), inset 0 0 34px rgba(242,196,102,0.3)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 rounded-b-[var(--poster-radius,12px)] bg-gradient-to-t from-black/85 via-black/25 to-transparent px-3 pb-3 pt-9">
      <span
        className={`block translate-y-2 text-[13px] font-semibold text-white transition-[transform,opacity] duration-300 ${EASE} ${
          preview ? "translate-y-0 opacity-100" : "opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        }`}
      >
        {meta.name}
      </span>
      <span
        className={`mt-1 block transition-opacity duration-300 delay-75 ${
          preview ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      >
        {ratingLine(meta)}
      </span>
      </div>
    </>
  );
}
