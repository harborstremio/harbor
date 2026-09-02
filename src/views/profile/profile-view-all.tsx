import { Award, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { FeaturedList } from "@/lib/social/featured-lists";
import { ListHeart } from "./list-heart";
import { ListShareButton } from "./list-share-button";
import { timeAgo } from "./profile-bits";
import { ACTIVITY_VERB, ActivityGlyph } from "./recent-activity";
import type { ActivityItem, Badge } from "./profile-types";

type Section = "lists" | "badges" | "activity";

const TITLES: Record<Section, string> = {
  lists: "My lists",
  badges: "Badges",
  activity: "Recent activity",
};

export function ProfileViewAll({
  section,
  lists,
  badges,
  activity,
  signedIn,
  isOwner,
  handle,
  onOpenMeta,
  onClose,
}: {
  section: Section;
  lists: FeaturedList[];
  badges: Badge[];
  activity: ActivityItem[];
  signedIn?: boolean;
  isOwner?: boolean;
  handle?: string;
  onOpenMeta?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[175] flex items-stretch justify-center bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t(TITLES[section])}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative m-6 flex max-h-[calc(100vh-3rem)] w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl border border-edge-soft bg-surface shadow-[0_30px_120px_-30px_rgba(0,0,0,0.85)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft px-7 py-5">
          <h2 className="font-display text-[24px] font-medium leading-tight tracking-tight text-ink">
            {t(TITLES[section])}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {section === "lists" && (
            <ListsSection
              lists={lists}
              onOpenMeta={onOpenMeta}
              signedIn={signedIn}
              isOwner={isOwner}
              handle={handle}
            />
          )}
          {section === "badges" && <BadgesSection badges={badges} />}
          {section === "activity" && <ActivitySection activity={activity} onOpenMeta={onOpenMeta} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Empty({ label }: { label: string }) {
  return <div className="flex h-40 items-center justify-center text-[13.5px] text-ink-muted">{label}</div>;
}

function ListsSection({
  lists,
  onOpenMeta,
  signedIn,
  isOwner,
  handle,
}: {
  lists: FeaturedList[];
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  signedIn?: boolean;
  isOwner?: boolean;
  handle?: string;
}) {
  const t = useT();
  const shown = lists.filter((l) => l.items.length > 0);
  if (shown.length === 0) return <Empty label={t("No lists to show")} />;
  return (
    <div className="space-y-8">
      {shown.map((list, i) => (
        <div key={list.id || `${list.name}:${i}`}>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-display text-[18px] text-ink">{list.name || "Untitled list"}</h3>
            <span className="text-[12px] tabular-nums text-ink-subtle">{list.items.length}</span>
            <div className="ml-auto flex items-center gap-2">
              <ListHeart
                handle={handle ?? ""}
                listId={list.id}
                count={list.likeCount ?? 0}
                liked={!!list.liked}
                interactive={!!signedIn && !isOwner}
              />
              <ListShareButton handle={handle ?? ""} listId={list.id} name={list.name} />
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-4 gap-y-5">
            {list.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenMeta?.(item.id, item.type, { name: item.name, poster: item.poster })}
                disabled={!onOpenMeta}
                className="group text-start disabled:cursor-default"
              >
                <Poster
                  src={item.poster || undefined}
                  seed={item.name || item.id}
                  ratio="portrait"
                  className="rounded-md ring-1 ring-edge-soft transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform motion-safe:group-hover:-translate-y-1"
                  lazy
                />
                {item.name && <div className="mt-1.5 line-clamp-2 text-[12px] text-ink-muted">{item.name}</div>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BadgesSection({ badges }: { badges: Badge[] }) {
  const t = useT();
  if (badges.length === 0) return <Empty label={t("No badges earned yet")} />;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {badges.map((b) => (
        <div key={b.id} className="flex gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            {b.iconUrl ? (
              <img
                src={b.iconUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
              />
            ) : (
              <Award size={28} className="text-ink-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[14px] font-semibold text-ink">{b.name}</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{b.description}</p>
            {b.rarityPct !== undefined && (
              <div className="mt-2 text-[11px] uppercase tracking-[0.1em] text-accent">
                {b.rarityPct < 1 ? "<1" : b.rarityPct.toFixed(0)}% of members
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivitySection({ activity, onOpenMeta }: { activity: ActivityItem[]; onOpenMeta?: (id: string) => void }) {
  const t = useT();
  if (activity.length === 0) return <Empty label={t("No recent activity")} />;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-1">
      {activity.map((a) => (
        <button
          key={a.id}
          onClick={() => a.metaId && onOpenMeta?.(a.metaId)}
          disabled={!a.metaId}
          className="group flex items-center gap-3 rounded-[12px] p-2.5 text-start transition-colors hover:bg-elevated disabled:cursor-default"
        >
          <div className="w-12 shrink-0">
            <Poster
              src={a.posterUrl}
              seed={a.title}
              ratio="portrait"
              className="rounded-[8px] ring-1 ring-edge-soft"
              lazy
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
              <ActivityGlyph kind={a.kind} size={15} />
              {ACTIVITY_VERB[a.kind]}
              {a.kind === "rated" && a.rating !== undefined && <span className="text-accent">{a.rating}/10</span>}
            </div>
            <div className="mt-0.5 truncate text-[14px] font-medium text-ink">{a.title}</div>
            {a.subtitle && <div className="truncate text-[12px] text-ink-muted">{a.subtitle}</div>}
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">{timeAgo(a.at)}</span>
        </button>
      ))}
    </div>
  );
}
