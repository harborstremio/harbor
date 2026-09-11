import { ListVideo, Plus } from "lucide-react";
import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "./section-header";
import { ListHeart } from "./list-heart";
import { ListShareButton } from "./list-share-button";
import { SaveListButton } from "./save-list-button";
import type { FeaturedItem, FeaturedList } from "@/lib/social/featured-lists";

function ListPoster({
  item,
  onOpenMeta,
}: {
  item: FeaturedItem;
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  return (
    <button
      onClick={() => onOpenMeta?.(item.id, item.type, { name: item.name, poster: item.poster })}
      disabled={!onOpenMeta}
      className="group w-full text-start disabled:cursor-default"
    >
      <Poster
        src={item.poster || undefined}
        seed={item.name || item.id}
        ratio="portrait"
        className="rounded-md ring-1 ring-edge-soft shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform group-hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)] motion-safe:group-hover:[transform:translate3d(0,-0.5rem,0)_scale(1.03)]"
        lazy
      />
      {item.name && <div className="mt-1.5 truncate text-[12px] text-ink-muted">{item.name}</div>}
    </button>
  );
}

export function MyListsShowcase({
  lists,
  isOwner,
  signedIn,
  onOpenMeta,
  onViewAll,
  onManage,
  handle,
}: {
  lists: FeaturedList[];
  isOwner?: boolean;
  signedIn?: boolean;
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  onViewAll?: () => void;
  onManage?: () => void;
  handle?: string;
}) {
  const t = useT();
  const shown = lists.filter((l) => l.items.length > 0);
  if (shown.length === 0 && !isOwner) {
    return (
      <section
        aria-label={t("My lists")}
        className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft"
      >
        <SectionHeader icon={<ListVideo size={20} />} label={t("My lists")} />
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {t("This user hasn't featured any lists")}
        </p>
      </section>
    );
  }
  return (
    <section aria-label={t("My lists")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <SectionHeader
        icon={<ListVideo size={20} />}
        label={t("My lists")}
        onViewAll={shown.length > 0 ? onViewAll : undefined}
      />
      {shown.length > 0 ? (
        <div className="space-y-5">
          {shown.map((list, i) => (
            <Row
              key={list.id || `${list.name}:${i}`}
              title={list.name || t("Untitled list")}
              titleExtra={
                <span className="text-[12px] tabular-nums text-ink-subtle">
                  {list.items.length}
                </span>
              }
              headerDescription={
                list.description && (
                  <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
                    {list.description}
                  </p>
                )
              }
              headerRight={
                <div className="flex items-center gap-2.5">
                  <ListHeart
                    handle={handle ?? ""}
                    listId={list.id}
                    count={list.likeCount ?? 0}
                    liked={!!list.liked}
                    interactive={!!signedIn && !isOwner}
                  />
                  <ListShareButton handle={handle ?? ""} listId={list.id} name={list.name} />
                  {signedIn && !isOwner && (
                    <SaveListButton handle={handle ?? ""} listId={list.id} />
                  )}
                </div>
              }
              min={96}
              shape="portrait"
              scrollKey={handle ? `profile:${handle}:list:${list.id || i}` : undefined}
            >
              {list.items.map((item) => (
                <ListPoster key={item.id} item={item} onOpenMeta={onOpenMeta} />
              ))}
            </Row>
          ))}
          {isOwner && onManage && (
            <button
              onClick={onManage}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-edge-soft text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <ListVideo size={18} /> {t("Choose lists")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-edge py-10 text-center">
          <p className="text-[14px] text-ink-muted">{t("No lists featured yet")}</p>
          <p className="mt-1 text-[12px] text-ink-subtle">
            {t("Pick lists from your library to show them here")}
          </p>
          {onManage && (
            <button
              onClick={onManage}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Plus size={18} /> {t("Choose lists")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
