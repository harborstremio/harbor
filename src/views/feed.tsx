import { useEffect, useRef } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import type { MetaType } from "@/lib/cinemeta";
import type { FeedItem } from "@/lib/social/feed";
import { FeedRow } from "./feed/feed-row";
import { WatchingStrip } from "./feed/watching-strip";
import { useFeed } from "./feed/use-feed";
import { ScrollToTop } from "@/views/profile/scroll-to-top";

export function FeedView({ onOpenProfile }: { onOpenProfile?: (handle: string) => void }) {
  const t = useT();
  const { openMeta, openManga } = useView();
  const f = useFeed();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !f.hasMore || f.loadingMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) f.loadMore();
      },
      { root: scrollRef.current, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [f.hasMore, f.loadingMore, f.loadMore]);

  const open = (item: FeedItem) => {
    if (item.type === "manga") {
      openManga(item.metaId);
      return;
    }
    const animeIsh = /^(kitsu|mal|anilist|anidb):/i.test(item.metaId);
    const type: MetaType = item.type === "series" || item.type === "anime" || animeIsh ? "series" : "movie";
    openMeta({ id: item.metaId, type, name: item.title, poster: item.posterUrl });
  };

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto bg-canvas">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
        style={{ background: "linear-gradient(180deg, color-mix(in oklch, var(--color-elevated), transparent 55%), transparent 80%)" }}
      />

      <div className="relative mx-auto w-full max-w-[820px] px-6 pb-24 pt-28 sm:px-10">
        <header className="mb-9 flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
            <Users size={14} /> {t("Friends")}
          </span>
          <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[42px]">
            {t("Activity")}
          </h1>
          {f.phase === "ready" && f.friendCount > 0 && (
            <p className="text-[13px] text-ink-muted">
              {t("{sharing} of {total} friends are sharing what they watch.", {
                sharing: f.sharingCount,
                total: f.friendCount,
              })}
            </p>
          )}
        </header>

        {f.watching.length > 0 && (
          <div className="mb-10">
            <WatchingStrip items={f.watching} onOpenProfile={onOpenProfile} />
          </div>
        )}

        {f.phase === "loading" ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="harbor-shimmer relative h-[88px] rounded-lg ring-1 ring-edge-soft"
                style={{ ["--ai-delay" as string]: `${i * 90}ms` }}
              />
            ))}
          </div>
        ) : f.phase === "error" ? (
          <Empty
            title={t("Could not load activity")}
            body={t("Check your connection and try again.")}
            action={{ label: t("Try again"), onClick: f.reload }}
          />
        ) : f.items.length === 0 ? (
          <Empty
            title={f.friendCount === 0 ? t("No friends yet") : t("Nothing here yet")}
            body={
              f.friendCount === 0
                ? t("Add a few friends and their watching, ratings, and favorites land here.")
                : t("Your friends have not shared anything yet. Activity sharing is off by default.")
            }
            icon={<UserPlus size={28} strokeWidth={1.7} />}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {f.items.map((item, i) => (
                <FeedRow
                  key={item.id}
                  item={item}
                  index={i}
                  onOpenProfile={onOpenProfile}
                  onOpenMeta={open}
                />
              ))}
            </div>
            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            {f.hasMore && (
              <button
                type="button"
                onClick={f.loadMore}
                disabled={f.loadingMore}
                className="mx-auto mt-8 flex h-10 items-center gap-2 rounded-full border border-edge-soft px-5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-50"
              >
                {f.loadingMore ? <Loader2 size={14} className="animate-spin" /> : null} {f.loadingMore ? t("Loading") : t("Load more")}
              </button>
            )}
          </>
        )}
      </div>
      <ScrollToTop targetRef={scrollRef} />
    </div>
  );
}

function Empty({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge bg-surface/30 px-6 py-16 text-center">
      {icon && <span className="text-ink-subtle">{icon}</span>}
      <div className="flex max-w-sm flex-col gap-1">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="text-[13px] leading-relaxed text-ink-subtle">{body}</span>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 flex h-10 items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
