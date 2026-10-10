import { Check, Heart, Play, Star } from "lucide-react";
import { useRatingPoster } from "@/lib/ratings/poster";
import { useT } from "@/lib/i18n";
import type { FeedItem } from "@/lib/social/feed";
import { Avatar, timeAgo } from "@/views/profile/profile-bits";

const ICONS = {
  watched: Play,
  finished: Check,
  favorited: Heart,
  rated: Star,
} as const;

export function FeedRow({
  item,
  index = 0,
  onOpenProfile,
  onOpenMeta,
}: {
  item: FeedItem;
  index?: number;
  onOpenProfile?: (handle: string) => void;
  onOpenMeta?: (item: FeedItem) => void;
}) {
  const t = useT();
  const poster = useRatingPoster(item.metaId, item.type ?? "movie", item.title, item.posterUrl);
  const Icon = ICONS[item.kind] ?? Play;
  const verb =
    item.kind === "finished"
      ? t("finished")
      : item.kind === "favorited"
        ? t("favorited")
        : item.kind === "rated"
          ? t("rated")
          : t("watched");

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 26, 300)}ms`, animationDuration: "400ms", animationFillMode: "both" }}
      className="group flex items-center gap-3 rounded-lg bg-surface p-2.5 ring-1 ring-edge-soft transition-colors duration-200 hover:bg-elevated motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
    >
      <button
        type="button"
        onClick={() => onOpenProfile?.(item.actor.handle)}
        aria-label={item.actor.alias}
        className="shrink-0 transition-transform duration-150 hover:scale-[1.06]"
      >
        <Avatar src={item.actor.avatarUrl} size={36} online={item.actor.online} alias={item.actor.alias} />
      </button>

      <button
        type="button"
        onClick={() => onOpenMeta?.(item)}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-ink-subtle">
            <span className="font-semibold text-ink-muted">{item.actor.alias}</span>
            <span>{verb}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(item.at)}</span>
          </span>
          <span className="truncate text-[14px] font-semibold text-ink transition-colors group-hover:text-ink">
            {item.title}
          </span>
          {item.subtitle && (
            <span className="truncate text-[12px] text-ink-subtle">{item.subtitle}</span>
          )}
        </span>

        {item.kind === "rated" && item.rating !== undefined && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-accent">
            <Star size={12} strokeWidth={2.4} fill="currentColor" />
            {item.rating}
          </span>
        )}

        {poster ? (
          <img
            src={poster}
            alt=""
            draggable={false}
            loading="lazy"
            className="h-[64px] w-[43px] shrink-0 rounded-[8px] object-cover ring-1 ring-edge-soft transition-transform duration-200 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid h-[64px] w-[43px] shrink-0 place-items-center rounded-[8px] bg-elevated text-ink-subtle ring-1 ring-edge-soft">
            <Icon size={15} />
          </span>
        )}
      </button>
    </div>
  );
}
