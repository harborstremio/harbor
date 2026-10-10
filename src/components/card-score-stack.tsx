import { Popcorn } from "lucide-react";
import { ImdbIcon } from "./icons/imdb-icon";
import { MalLogo } from "./icons/mal-logo";
import { RtBadge } from "./rt-badge";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";
export type CardBadge =
  | { kind: "rating"; source: "imdb" | "mal" | "tmdb"; value: string }
  | { kind: "rt"; value: number }
  | { kind: "audience"; value: number }
  | { kind: "metacritic"; value: number }
  | { kind: "letterboxd"; value: number }
  | { kind: "mdblist"; value: number }
  | { kind: "trakt"; value: number }
  | { kind: "simkl"; value: number };

function metacriticTone(v: number): string {
  if (v >= 61) return "bg-emerald-500";
  if (v >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function BadgeContent({ badge }: { badge: CardBadge }) {
  switch (badge.kind) {
    case "rating":
      return (
        <span className="flex items-center gap-1">
          {badge.source === "mal" ? (
            <MalLogo className="h-[11px] w-auto text-ink-muted" />
          ) : badge.source === "tmdb" ? (
            <span className="text-[8.5px] font-bold leading-none tracking-tight text-ink-muted">TMDB</span>
          ) : (
            <ImdbIcon className="h-[11px] w-auto rounded-[2px]" />
          )}
          <span>{badge.value}</span>
        </span>
      );
    case "rt":
      return (
        <span className="flex items-center gap-0.5">
          <RtBadge score={badge.value} className="h-[12px] w-auto" />
          <span>{badge.value}%</span>
        </span>
      );
    case "audience":
      return (
        <span className="flex items-center gap-0.5">
          <Popcorn size={12} strokeWidth={2.4} className={badge.value >= 60 ? "text-accent" : "text-ink-muted"} />
          <span>{Math.round(badge.value)}%</span>
        </span>
      );
    case "metacritic":
      return (
        <span
          className={`flex h-[13px] min-w-[15px] items-center justify-center rounded-[3px] px-0.5 text-[8.5px] font-bold text-white ${metacriticTone(badge.value)}`}
        >
          {Math.round(badge.value)}
        </span>
      );
    case "letterboxd":
      return (
        <span className="flex items-center gap-0.5">
          <img src={letterboxdLogo} alt="" className="h-[11px] w-[11px] rounded-[2px] object-cover" />
          <span>{(badge.value / 2).toFixed(1)}</span>
        </span>
      );
    case "mdblist":
      return (
        <span className="flex items-center gap-0.5">
          <img src={mdblistLogo} alt="" className="h-[11px] w-[11px] rounded-[2px] object-contain" />
          <span>{Math.round(badge.value)}</span>
        </span>
      );
    case "trakt":
      return (
        <span className="flex items-center gap-0.5">
          <img src={traktLogo} alt="" className="h-[11px] w-[11px] object-contain" />
          <span>{Math.round(badge.value)}%</span>
        </span>
      );
    case "simkl":
      return (
        <span className="flex items-center gap-0.5">
          <img src={simklLogo} alt="" className="h-[11px] w-[11px] rounded-[2px] object-contain" />
          <span>{Math.round(badge.value)}</span>
        </span>
      );
  }
}

export function ScoreStack({
  badges,
  limit = 3,
  placement = "bottom",
  raised = false,
}: {
  badges: readonly CardBadge[];
  limit?: number;
  placement?: "top" | "bottom";
  raised?: boolean;
}) {
  const shown = badges.slice(0, Math.max(1, limit));
  if (shown.length === 0) return null;
  const scale = shown.length <= 3 ? 1 : shown.length === 4 ? 0.88 : shown.length === 5 ? 0.78 : 0.7;
  return (
    <div
      style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "right" } : undefined}
      className={`absolute end-1.5 flex items-center gap-1 whitespace-nowrap rounded-md bg-canvas/95 px-1.5 py-0.5 text-[10px] font-semibold text-ink ${
        placement === "top" ? "top-1.5" : raised ? "bottom-9" : "bottom-1.5"
      }`}
    >
      {shown.map((b, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="opacity-30">·</span>}
          <BadgeContent badge={b} />
        </span>
      ))}
    </div>
  );
}

