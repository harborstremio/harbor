import { ChevronRight } from "lucide-react";
import { Avatar } from "@/views/profile/profile-bits";
import { ListHeart } from "@/views/profile/list-heart";
import { ListShareButton } from "@/views/profile/list-share-button";
import { SaveListButton } from "@/views/profile/save-list-button";
import type { FeaturedList } from "@/lib/social/featured-lists";
import type { ProfileSummary } from "@/views/profile/profile-types";

export function SharedListHero({
  summary,
  list,
  signedIn,
  onOpenProfile,
}: {
  summary: ProfileSummary;
  list: FeaturedList;
  signedIn: boolean;
  onOpenProfile?: (handle: string) => void;
}) {
  const openMaker = onOpenProfile ? () => onOpenProfile(summary.handle) : undefined;
  const count = list.items.length;
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <button
        type="button"
        onClick={openMaker}
        disabled={!openMaker}
        className="group inline-flex flex-col items-center gap-3 disabled:cursor-default"
      >
        <Avatar src={summary.avatarUrl} size={88} alias={summary.alias} />
        <span className="inline-flex items-center gap-1.5 text-[13.5px]">
          <span className="font-medium text-ink-muted transition-colors group-hover:text-ink">
            {summary.alias}
          </span>
          <span className="text-ink-subtle">@{summary.handle}</span>
        </span>
      </button>

      <div className="flex flex-col items-center gap-3">
        <h1 className="font-display text-[36px] leading-[1.04] text-ink sm:text-[46px]">
          {list.name || "Untitled list"}
        </h1>
        {list.description && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-ink-muted">{list.description}</p>
        )}
        <span className="text-[13px] tabular-nums text-ink-subtle">
          {count} {count === 1 ? "title" : "titles"}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <ListHeart
          handle={summary.handle}
          listId={list.id}
          count={list.likeCount ?? 0}
          liked={!!list.liked}
          interactive={signedIn && !summary.isOwner}
        />
        <ListShareButton handle={summary.handle} listId={list.id} name={list.name} />
        {signedIn && !summary.isOwner && (
          <SaveListButton handle={summary.handle} listId={list.id} />
        )}
        {openMaker && (
          <button
            type="button"
            onClick={openMaker}
            className="group inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3.5 text-[12.5px] font-semibold text-ink ring-1 ring-edge transition-colors hover:bg-raised"
          >
            View all
            <ChevronRight
              size={15}
              strokeWidth={2.2}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>
    </div>
  );
}
