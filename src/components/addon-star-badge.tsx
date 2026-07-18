import { Sparkles, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useCommunity } from "@/lib/providers/stremio-addons-index";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function AddonStarBadge({
  manifestId,
  size = "md",
  tone = "auto",
  className = "",
}: {
  manifestId: string | undefined | null;
  size?: "xs" | "sm" | "md" | "lg";
  tone?: "auto" | "dark" | "light";
  className?: string;
}) {
  const t = useT();
  const community = useCommunity(manifestId);
  if (!community) return null;
  const dims = SIZES[size];
  const palette = TONES[tone];
  const isNew = isRecent(community.createdAt);
  if (community.stars <= 0 && !isNew) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`}>
      {community.stars > 0 && (
        <span
          className={`${palette.bg} ${palette.fg} ${palette.ring} ${dims.pill} inline-flex shrink-0 items-center gap-1 rounded-full font-bold`}
          title={t("{count} community ratings on stremio-addons.net", {
            count: community.stars.toLocaleString(),
          })}
        >
          <Star
            size={dims.icon}
            strokeWidth={2.6}
            fill="currentColor"
            className="harbor-rating-star"
          />
          {community.stars.toLocaleString()}
        </span>
      )}
      {isNew && (
        <span
          className={`${dims.pill} inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 font-bold uppercase tracking-[0.14em] text-emerald-300 ring-1 ring-emerald-500/30`}
          title={t("Added to stremio-addons.net in the last 14 days")}
        >
          <Sparkles size={dims.icon} strokeWidth={2.6} />
          {t("New")}
        </span>
      )}
    </span>
  );
}

function isRecent(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < NEW_WINDOW_MS;
}

const SIZES = {
  xs: { pill: "h-4 px-1.5 text-[9.5px]", icon: 8 },
  sm: { pill: "h-5 px-1.5 text-[10.5px]", icon: 9 },
  md: { pill: "h-6 px-2 text-[11px]", icon: 10 },
  lg: { pill: "h-7 px-2.5 text-[12.5px]", icon: 12 },
} as const;

const TONES = {
  auto: {
    bg: "bg-canvas/70",
    fg: "text-accent",
    ring: "ring-1 ring-accent/30",
  },
  dark: {
    bg: "bg-black/55",
    fg: "text-amber-300",
    ring: "ring-1 ring-amber-300/30",
  },
  light: {
    bg: "bg-white/85",
    fg: "text-amber-700",
    ring: "ring-1 ring-amber-700/30",
  },
} as const;
