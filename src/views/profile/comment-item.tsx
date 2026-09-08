import { ChevronDown, Heart, Reply, Trash2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { segmentMentions } from "@/lib/social/mentions";
import { Avatar, timeAgo } from "./profile-bits";
import { CommentCompose } from "./comment-compose";
import { MentionLink } from "./mention-link";
import { segmentProfanity, type ComposeIssue } from "./text-safety";
import { UserHoverCard } from "./user-hover-card";
import { useSelfAvatar } from "./use-self-avatar";
import type { Comment } from "./profile-types";
import { VerifiedBadge } from "@/views/account/verified-badge";
import { useContextTarget } from "@/lib/context-menu";
import { copyContextText } from "@/components/context-menu/content-actions";
import { confirmDialog } from "@/lib/dialog";

function SafeBody({
  body,
  onOpenAuthor,
}: {
  body: string;
  onOpenAuthor?: (handle: string) => void;
}) {
  const t = useT();
  return (
    <p className="mt-1 select-text whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-muted">
      {segmentMentions(body).map((seg, i) =>
        seg.handle ? (
          <MentionLink key={i} handle={seg.handle} label={seg.text} onOpen={onOpenAuthor} />
        ) : (
          segmentProfanity(seg.text).map((s, j) =>
            s.masked ? (
              <span
                key={`${i}.${j}`}
                title={t("Hidden language")}
                className="cursor-default rounded-[4px] bg-elevated px-1 blur-[5px] transition-[filter] duration-150 hover:blur-0"
              >
                {s.text}
              </span>
            ) : (
              <span key={`${i}.${j}`}>{s.text}</span>
            ),
          )
        ),
      )}
    </p>
  );
}

export function CommentItem({
  c,
  canDelete,
  signedIn,
  onDelete,
  onToggleLike,
  onOpenAuthor,
  onReply,
  replyToId,
  replies,
  sending,
}: {
  c: Comment;
  canDelete: boolean;
  signedIn?: boolean;
  onDelete: (id: string) => void | Promise<void>;
  onToggleLike?: (id: string) => void | Promise<void>;
  onOpenAuthor?: (handle: string) => void;
  onReply?: (raw: string, parentId: string) => Promise<ComposeIssue>;
  replyToId?: string;
  replies?: Comment[];
  sending?: boolean;
}) {
  const t = useT();
  const self = useSelfAvatar();
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const mine = !!self.handle && self.handle.toLowerCase() === c.authorHandle.toLowerCase();
  const avatarSrc = mine ? (self.avatar ?? c.authorAvatarUrl) : c.authorAvatarUrl;
  const avatarFallback = mine ? c.authorAvatarUrl : undefined;
  const canReply = !!onReply && !!signedIn && !!replyToId;
  const [actionError, setActionError] = useState("");
  const removeComment = async () => {
    if (await confirmDialog(t("Delete this comment? This cannot be undone."))) await onDelete(c.id);
  };
  const act = async (action: () => void | Promise<void>) => {
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error ? t(error.message) : t("The action could not be completed."),
      );
    }
  };
  const contextRef = useContextTarget<HTMLDivElement>(() => ({
    kind: "actions",
    id: `comment:${c.id}`,
    label: t("Comment"),
    contentPolicy: "separate",
    actions: () => [
      { id: "comment:copy", label: t("Copy comment text"), run: () => copyContextText(c.body) },
      ...(signedIn && onToggleLike
        ? [
            {
              id: "comment:like",
              label: c.liked ? t("Unlike comment") : t("Like comment"),
              group: "comment",
              run: () => onToggleLike(c.id),
            },
          ]
        : []),
      ...(canReply
        ? [
            {
              id: "comment:reply",
              label: t("Reply"),
              group: "comment",
              restoreFocus: false,
              run: () => setReplying(true),
            },
          ]
        : []),
      ...(onOpenAuthor
        ? [
            {
              id: "comment:author",
              label: t("Open author profile"),
              group: "author",
              run: () => onOpenAuthor(c.authorHandle),
            },
          ]
        : []),
      ...(canDelete
        ? [
            {
              id: "comment:delete",
              label: t("Delete comment"),
              group: "remove",
              danger: true,
              run: removeComment,
            },
          ]
        : []),
    ],
  }));
  return (
    <div ref={contextRef} className="flex flex-col" tabIndex={0}>
      <div className="group flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-elevated/60">
        <UserHoverCard handle={c.authorHandle}>
          <button
            onClick={() => onOpenAuthor?.(c.authorHandle)}
            aria-label={t("Open {alias} profile", { alias: c.authorAlias })}
            className="shrink-0"
          >
            <Avatar src={avatarSrc} fallbackSrc={avatarFallback} size={36} alias={c.authorAlias} />
          </button>
        </UserHoverCard>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <UserHoverCard handle={c.authorHandle}>
              <button
                onClick={() => onOpenAuthor?.(c.authorHandle)}
                className="min-w-0 truncate text-[13px] font-semibold text-ink hover:text-accent"
              >
                {c.authorAlias}
              </button>
            </UserHoverCard>
            {c.authorVerified && <VerifiedBadge size="sm" />}
            <span className="shrink-0 text-[12px] text-ink-subtle">@{c.authorHandle}</span>
            <span className="shrink-0 text-[12px] text-ink-subtle">·</span>
            <span className="shrink-0 text-[12px] text-ink-subtle">{timeAgo(c.at)}</span>
            {c.flagged && (
              <span className="rounded-[4px] bg-surface px-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
                {t("Filtered")}
              </span>
            )}
          </div>
          <SafeBody body={c.body} onOpenAuthor={onOpenAuthor} />
          <div className="mt-1.5 flex items-center gap-1">
            <button
              onClick={() => void act(() => onToggleLike?.(c.id))}
              disabled={!signedIn}
              aria-pressed={!!c.liked}
              aria-label={c.liked ? t("Unlike comment") : t("Like comment")}
              className={`-ml-2 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] tabular-nums transition-colors disabled:cursor-default ${
                c.liked
                  ? "text-danger"
                  : `text-ink-subtle ${signedIn ? "hover:text-ink-muted" : ""}`
              } ${signedIn ? "hover:bg-elevated/70" : ""}`}
            >
              <Heart size={15} className={c.liked ? "fill-current" : ""} />
              {(c.likeCount ?? 0) > 0 && <span>{c.likeCount}</span>}
            </button>
            {canReply && (
              <button
                onClick={() => setReplying((v) => !v)}
                aria-expanded={replying}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink-muted"
              >
                <Reply size={15} /> {replying ? t("Cancel") : t("Reply")}
              </button>
            )}
          </div>
          {canReply && replying && (
            <div className="mt-2">
              <CommentCompose
                autoFocus
                onSubmit={async (raw) => {
                  const res = await onReply!(raw, replyToId!);
                  if (!res) setReplying(false);
                  return res;
                }}
                sending={!!sending}
                disabled={!signedIn}
              />
            </div>
          )}
        </div>
        {canDelete && (
          <button
            onClick={() => void act(removeComment)}
            aria-label={t("Delete comment")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-subtle opacity-0 transition-all hover:bg-surface hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
      {actionError && (
        <p role="alert" className="px-2 py-1 text-[12px] text-danger">
          {actionError}
        </p>
      )}
      {replies && replies.length > 0 && (
        <div className="ml-12 flex flex-col">
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            aria-expanded={showReplies}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink-muted"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${showReplies ? "rotate-180" : ""}`}
            />
            {showReplies
              ? t("Hide replies")
              : replies.length === 1
                ? t("Show 1 reply")
                : t("Show {count} replies", { count: replies.length })}
          </button>
          {showReplies && (
            <div className="flex flex-col border-l border-edge-soft pl-2">
              {replies.map((r) => (
                <CommentItem
                  key={r.id}
                  c={r}
                  replyToId={replyToId}
                  canDelete={canDelete}
                  signedIn={signedIn}
                  onDelete={onDelete}
                  onToggleLike={onToggleLike}
                  onReply={onReply}
                  sending={sending}
                  onOpenAuthor={onOpenAuthor}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
