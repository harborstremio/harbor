import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { CommentCompose } from "./comment-compose";
import { CommentItem } from "./comment-item";
import type { Comment } from "./profile-types";
import { useComments } from "./use-comments";

const COMMENTS_PAGE = 5;
const COMMENTS_STEP = 12;

export function CommentsSection({
  handle,
  isOwner,
  signedIn,
  onOpenAuthor,
}: {
  handle: string;
  isOwner: boolean;
  signedIn: boolean;
  onOpenAuthor?: (h: string) => void;
}) {
  const t = useT();
  const { state, comments, total, hasMore, loadMore, submit, remove, toggleLike, sending } = useComments(handle);
  const [shown, setShown] = useState(COMMENTS_PAGE);

  useEffect(() => {
    setShown(COMMENTS_PAGE);
  }, [handle]);

  const ids = new Set(comments.map((c) => c.id));
  const roots = comments.filter((c) => !c.parentId || !ids.has(c.parentId));
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (!c.parentId || !ids.has(c.parentId)) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }

  const visible = roots.slice(0, shown);
  const hiddenLocal = Math.max(0, roots.length - shown);
  const canShowMore = hiddenLocal > 0 || hasMore;
  const nextCount = hiddenLocal > 0 ? Math.min(hiddenLocal, COMMENTS_STEP) : COMMENTS_STEP;

  const showMore = () => {
    const next = shown + COMMENTS_STEP;
    setShown(next);
    if (next >= roots.length && hasMore) loadMore();
  };
  return (
    <section aria-label={t("Comments")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        <MessageSquare size={20} /> {t("Comments")}
        {total > 0 && <span className="tabular-nums text-ink-subtle">({total})</span>}
      </div>

      <div className="mb-4">
        <CommentCompose onSubmit={submit} sending={sending} disabled={!signedIn} />
      </div>

      {state === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 p-2">
              <div className="h-9 w-9 shrink-0 rounded-full bg-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-elevated" />
                <div className="h-3 w-4/5 rounded bg-elevated" />
              </div>
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <p className="py-6 text-center text-[13px] text-ink-subtle">{t("Could not load comments")}</p>
      )}

      {state === "empty" && (
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {t("No comments yet. Be the first to say hello.")}
        </p>
      )}

      {state === "ready" && (
        <div className="flex flex-col gap-1">
          {visible.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              replyToId={c.id}
              replies={repliesByParent.get(c.id)}
              canDelete={isOwner}
              signedIn={signedIn}
              onDelete={remove}
              onToggleLike={toggleLike}
              onReply={submit}
              sending={sending}
              onOpenAuthor={onOpenAuthor}
            />
          ))}
          {canShowMore && (
            <button
              onClick={showMore}
              className="mx-auto mt-2 inline-flex min-h-11 items-center rounded-md bg-elevated px-5 text-[13px] font-medium text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised"
            >
              {t("Show {count} more", { count: nextCount })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
