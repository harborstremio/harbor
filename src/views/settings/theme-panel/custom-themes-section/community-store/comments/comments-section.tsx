import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "../../../../icons";
import { useT } from "@/lib/i18n";
import { RowNote } from "@/views/settings/shared";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import type { ThemeComment } from "@/lib/theme-store";
import { useComments } from "./use-comments";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

export function CommentsSection({ themeId }: { themeId: string }) {
  const t = useT();
  const { comments, loading, error, add, remove } = useComments(themeId);
  const [author, setAuthor] = useState(currentAuthor());
  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  const ids = new Set(comments.map((c) => c.id));
  const roots = comments.filter((c) => !c.parentId || !ids.has(c.parentId));
  const repliesByParent = new Map<string, ThemeComment[]>();
  for (const c of comments) {
    if (!c.parentId || !ids.has(c.parentId)) continue;
    const list = repliesByParent.get(c.parentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentId, list);
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  return (
    <section className="flex flex-col gap-4">
      <h3 className="harbor-settings-label flex items-center gap-2">
        <MessageSquare size={16} className="text-ink-subtle" />
        {t("Comments")}
        {comments.length > 0 && (
          <span className="text-ink-subtle tabular-nums">{comments.length}</span>
        )}
      </h3>

      {author ? (
        <CommentComposer onSubmit={add} />
      ) : (
        <p className="max-w-[70ch] rounded-sm bg-surface px-4 py-5 text-[15.5px] font-normal leading-[22px] tracking-[-0.02px] text-ink-muted ring-1 ring-edge-soft">
          {t("Sign in from the My themes tab to join the conversation.")}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6 text-ink-subtle">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : error ? (
        <RowNote>{error}</RowNote>
      ) : comments.length === 0 ? (
        <p className="max-w-[70ch] py-4 text-[15.5px] font-normal leading-[22px] tracking-[-0.02px] text-ink-subtle">
          {t("No comments yet. Start the conversation.")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {roots.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onDelete={remove}
              onReply={add}
              replyToId={c.id}
              replies={repliesByParent.get(c.id)}
              signedIn={!!author}
            />
          ))}
        </div>
      )}
    </section>
  );
}
