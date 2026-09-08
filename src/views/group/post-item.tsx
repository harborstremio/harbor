import { useRef, useState } from "react";
import { Copy, Heart, Loader2, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
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
import { useContextTarget } from "@/lib/context-menu";
import { copyContextText } from "@/components/context-menu/content-actions";
import { confirmDialog } from "@/lib/dialog";
import { currentAuthor } from "@/lib/theme-auth";
import { requestOpenProfile } from "@/lib/social/open-profile";

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
  const pending = useRef(false);
  const [actionError, setActionError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
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

  const mutate = async (command: "like" | "pin" | "delete") => {
    if (pending.current) throw new Error(t("An update is already in progress."));
    const author = currentAuthor()?.handle;
    if (!author || (command === "pin" && !post.canPin) || (command === "delete" && !post.canDelete))
      throw new Error(t("This action is no longer available."));
    pending.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (command === "delete") {
        if (!(await confirmDialog(t("Delete this post from the group?")))) return;
        if (currentAuthor()?.handle !== author) throw new Error(t("The active profile changed."));
        await deleteGroupPost(groupId, post.id);
        if (currentAuthor()?.handle === author) onRemoved(post.id);
      } else {
        const updated =
          command === "like"
            ? await likeGroupPost(groupId, post.id, !post.liked)
            : await pinGroupPost(groupId, post.id, !post.pinned);
        if (currentAuthor()?.handle === author) onChanged(updated);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const runFromButton = (command: "like" | "pin" | "delete") => {
    void mutate(command).catch((error: unknown) =>
      setActionError(
        error instanceof Error ? error.message : t("The action could not be completed."),
      ),
    );
  };
  const contextRef = useContextTarget<HTMLElement>(() => ({
    kind: "actions",
    id: `post:${groupId}:${post.id}`,
    label: t("Post"),
    contentPolicy: "separate",
    actions: () => [
      {
        id: `post:copy:${post.id}`,
        label: t("Copy post text"),
        icon: <Copy size={14} />,
        run: () => copyContextText(bodyRef.current?.innerText ?? post.body),
      },
      ...(currentAuthor()
        ? [
            {
              id: `post:like:${post.id}`,
              label: post.liked ? t("Unlike") : t("Like"),
              disabled: busy,
              run: () => mutate("like"),
            },
          ]
        : []),
      ...(post.author
        ? [
            {
              id: `post:author:${post.id}`,
              label: t("Open profile"),
              group: "author",
              run: () => requestOpenProfile(post.author!.handle),
            },
          ]
        : []),
      ...(post.canEdit
        ? [
            {
              id: `post:edit:${post.id}`,
              label: t("Edit post"),
              group: "manage",
              disabled: busy,
              run: beginEdit,
              restoreFocus: false,
            },
          ]
        : []),
      ...(post.canPin
        ? [
            {
              id: `post:pin:${post.id}`,
              label: post.pinned ? t("Unpin") : t("Pin"),
              group: "manage",
              disabled: busy,
              run: () => mutate("pin"),
            },
          ]
        : []),
      ...(post.canDelete
        ? [
            {
              id: `post:delete:${post.id}`,
              label: t("Delete post…"),
              group: "delete",
              danger: true,
              disabled: busy,
              run: () => mutate("delete"),
            },
          ]
        : []),
    ],
  }));

  return (
    <article
      ref={contextRef}
      tabIndex={0}
      style={{
        animationDelay: `${Math.min(index * 40, 320)}ms`,
        animationDuration: "420ms",
        animationFillMode: "both",
      }}
      className={`group/post relative flex gap-3 rounded-lg p-3.5 ring-1 transition-colors duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 ${
        post.pinned
          ? "bg-elevated/60 ring-accent/25"
          : "bg-surface ring-edge-soft hover:bg-elevated/40"
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
          <span aria-hidden className="text-[12px] text-ink-subtle">
            ·
          </span>
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
              className="harbor-scroll min-h-[64px] w-full resize-none rounded-md bg-elevated px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-edge-soft transition-shadow focus:ring-edge"
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
          <div ref={bodyRef}>
            <PostBody body={post.body} onOpenProfile={onOpenProfile} />
          </div>
        )}

        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => runFromButton("like")}
            disabled={busy}
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
                onClick={() => runFromButton("pin")}
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
                onClick={() => runFromButton("delete")}
                disabled={busy}
                className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${"text-ink-subtle hover:bg-elevated hover:text-danger"}`}
              >
                <Trash2 size={14} /> {t("Delete")}
              </button>
            )}
          </div>
        </div>
        {actionError && (
          <p role="alert" className="text-[12px] text-danger">
            {actionError}
          </p>
        )}
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
  if (!post.author)
    return <span className="text-[13.5px] font-semibold text-ink">{t("Someone")}</span>;
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
