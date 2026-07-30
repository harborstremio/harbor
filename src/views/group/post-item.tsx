import { useRef, useState } from "react";
import { Heart, Loader2, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAutosize } from "@/lib/use-autosize";
import { PostBody } from "./post-body";
import {
  deleteGroupPost,
  editGroupPost,
  likeGroupPost,
  pinGroupPost,
  type GroupPost,
} from "@/lib/social/group-posts";
import { Avatar, timeAgo } from "@/views/profile/profile-bits";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { VerifiedBadge } from "@/views/account/verified-badge";

const POST_MAX = 2000;

export function PostItem({
  post,
  groupId,
  index = 0,
  onChanged,
  onRemoved,
  onOpenProfile,
}: {
  post: GroupPost;
  groupId: string;
  index?: number;
  onChanged: (p: GroupPost) => void;
  onRemoved: (id: string) => void;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [editError, setEditError] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(editRef, draft);

  const beginEdit = () => {
    setDraft(post.body);
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    const next = draft.trim();
    if (!next || busy) return;
    if (next === post.body.trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setEditError(null);
    try {
      onChanged(await editGroupPost(groupId, post.id, next));
      setEditing(false);
    } catch (e) {
      setEditError((e as Error).message || t("Could not save that edit."));
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async () => {
    const next = !post.liked;
    onChanged({ ...post, liked: next, likeCount: post.likeCount + (next ? 1 : -1) });
    try {
      onChanged(await likeGroupPost(groupId, post.id, next));
    } catch {
      onChanged(post);
    }
  };

  const togglePin = async () => {
    setBusy(true);
    try {
      onChanged(await pinGroupPost(groupId, post.id, !post.pinned));
    } catch {
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteGroupPost(groupId, post.id);
      onRemoved(post.id);
    } catch {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationDuration: "420ms", animationFillMode: "both" }}
      className={`group/post relative flex gap-3 rounded-[14px] p-3.5 ring-1 transition-colors duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 ${
        post.pinned ? "bg-elevated/60 ring-accent/25" : "bg-surface ring-edge-soft hover:bg-elevated/40"
      }`}
    >
      <AuthorAvatar post={post} onOpenProfile={onOpenProfile} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {post.pinned && (
            <span className="flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent">
              <Pin size={10} strokeWidth={2.6} /> {t("Announcement")}
            </span>
          )}
          <AuthorName post={post} onOpenProfile={onOpenProfile} />
          <span aria-hidden className="text-[12px] text-ink-subtle">·</span>
          <span className="text-[12px] text-ink-subtle">{timeAgo(post.createdAt)}</span>
          {post.editedAt && <span className="text-[12px] text-ink-subtle">({t("edited")})</span>}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              ref={editRef}
              value={draft}
              maxLength={POST_MAX}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              className="harbor-scroll min-h-[64px] w-full resize-none rounded-[10px] bg-elevated px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-edge-soft transition-shadow focus:ring-edge"
            />
            {editError && <p className="text-[12.5px] text-danger">{editError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busy || !draft.trim()}
                className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy && <Loader2 size={13} className="animate-spin" />} {t("Save")}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
              >
                {t("Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <PostBody body={post.body} onOpenProfile={onOpenProfile} />
        )}

        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => void toggleLike()}
            aria-pressed={post.liked}
            className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors active:scale-[0.95] ${
              post.liked ? "text-danger" : "text-ink-subtle hover:bg-elevated hover:text-ink"
            }`}
          >
            <Heart size={14} strokeWidth={2.2} fill={post.liked ? "currentColor" : "none"} />
            {post.likeCount > 0 && <span className="tabular-nums">{post.likeCount}</span>}
          </button>

          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/post:opacity-100">
            {post.canEdit && !editing && (
              <button
                type="button"
                onClick={beginEdit}
                disabled={busy}
                className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink disabled:opacity-50"
              >
                <Pencil size={14} /> {t("Edit")}
              </button>
            )}
            {post.canPin && (
              <button
                type="button"
                onClick={() => void togglePin()}
                disabled={busy}
                className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink disabled:opacity-50"
              >
                {post.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                {post.pinned ? t("Unpin") : t("Pin")}
              </button>
            )}
            {post.canDelete && (
              <button
                type="button"
                onClick={() => (confirming ? void remove() : setConfirming(true))}
                onBlur={() => setConfirming(false)}
                disabled={busy}
                className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                  confirming ? "bg-danger/15 text-danger" : "text-ink-subtle hover:bg-elevated hover:text-danger"
                }`}
              >
                <Trash2 size={14} /> {confirming ? t("Confirm") : t("Delete")}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function AuthorAvatar({
  post,
  onOpenProfile,
}: {
  post: GroupPost;
  onOpenProfile?: (handle: string) => void;
}) {
  const btn = (
    <button
      type="button"
      onClick={() => post.author && onOpenProfile?.(post.author.handle)}
      disabled={!post.author}
      className="shrink-0 self-start transition-transform duration-150 hover:scale-[1.05] disabled:cursor-default"
    >
      <Avatar src={post.author?.avatarUrl} size={38} alias={post.author?.alias} />
    </button>
  );
  if (!post.author) return btn;
  return <UserHoverCard handle={post.author.handle}>{btn}</UserHoverCard>;
}

function AuthorName({
  post,
  onOpenProfile,
}: {
  post: GroupPost;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  if (!post.author) return <span className="text-[13.5px] font-semibold text-ink">{t("Someone")}</span>;
  return (
    <UserHoverCard handle={post.author.handle}>
      <button
        type="button"
        onClick={() => post.author && onOpenProfile?.(post.author.handle)}
        className="flex items-baseline gap-2 text-start"
      >
        <span className="text-[13.5px] font-semibold text-ink">{post.author.alias}</span>
        {post.author.verified && <VerifiedBadge size="sm" />}
        <span className="text-[12px] text-ink-subtle">@{post.author.handle}</span>
      </button>
    </UserHoverCard>
  );
}
