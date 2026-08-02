import { useState } from "react";
import { ChevronDown, Loader2, Reply as ReplyIcon, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ThemeComment } from "@/lib/theme-store";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { Avatar } from "@/views/profile/profile-bits";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { CommentBody } from "./comment-render";
import { CommentComposer } from "./comment-composer";
import { timeAgo } from "../time-ago";

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function CommentItem({
  comment,
  onDelete,
  onReply,
  replyToId,
  replies,
  signedIn,
}: {
  comment: ThemeComment;
  onDelete: (id: string) => Promise<void>;
  onReply?: (body: string, parentId: string) => Promise<void>;
  replyToId?: string;
  replies?: ThemeComment[];
  signedIn?: boolean;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const name = comment.author || "Anonymous";
  const handle = comment.authorHandle || null;
  const hue = hueOf(name);
  const canReply = !!onReply && !!signedIn && !!replyToId;

  const del = async () => {
    if (!confirm) {
      setConfirm(true);
      window.setTimeout(() => setConfirm(false), 2600);
      return;
    }
    setBusy(true);
    try {
      await onDelete(comment.id);
    } catch {
      setBusy(false);
      setConfirm(false);
    }
  };

  const avatarEl = handle ? (
    <UserHoverCard handle={handle}>
      <button
        type="button"
        onClick={() => requestOpenProfile(handle)}
        aria-label={`Open ${name} profile`}
        className="mt-0.5 shrink-0"
      >
        <Avatar src={comment.authorAvatar ?? undefined} size={32} alias={name} />
      </button>
    </UserHoverCard>
  ) : (
    <span
      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white ring-1 ring-white/15"
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.15 ${hue}), oklch(0.5 0.16 ${(hue + 40) % 360}))` }}
    >
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );

  const nameEl = handle ? (
    <UserHoverCard handle={handle}>
      <button
        type="button"
        onClick={() => requestOpenProfile(handle)}
        className="truncate text-[13px] font-semibold text-ink transition-colors hover:text-accent"
      >
        {name}
      </button>
    </UserHoverCard>
  ) : (
    <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="group flex gap-3">
        {avatarEl}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            {nameEl}
            {handle && <span className="shrink-0 font-display text-[11.5px] text-ink-subtle">@{handle}</span>}
            <span className="shrink-0 text-[11.5px] text-ink-subtle">{timeAgo(comment.createdAt)}</span>
            {comment.canDelete && (
              <button
                type="button"
                onClick={del}
                disabled={busy}
                className={`ms-auto flex h-7 items-center gap-1 rounded-[4px] px-2 text-[11.5px] font-semibold transition-all ${
                  confirm
                    ? "bg-danger/15 text-danger"
                    : "text-ink-subtle opacity-0 hover:bg-elevated hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                }`}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {confirm && "Remove?"}
              </button>
            )}
          </div>
          <CommentBody text={comment.body} />
          {canReply && (
            <div className="mt-0.5 flex">
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                aria-expanded={replying}
                className="flex h-7 items-center gap-1 rounded-[4px] px-1.5 text-[11.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
              >
                <ReplyIcon size={12} /> {replying ? t("Cancel") : t("Reply")}
              </button>
            </div>
          )}
          {canReply && replying && (
            <div className="mt-1">
              <CommentComposer
                onSubmit={async (body) => {
                  await onReply!(body, replyToId!);
                  setReplying(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
      {replies && replies.length > 0 && (
        <div className="ms-11 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            aria-expanded={showReplies}
            className="flex h-7 w-fit items-center gap-1.5 rounded-[4px] px-1.5 text-[11.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${showReplies ? "rotate-180" : ""}`}
            />
            {showReplies
              ? t("Hide replies")
              : replies.length === 1
                ? t("Show 1 reply")
                : t("Show {count} replies", { count: replies.length })}
          </button>
          {showReplies && (
            <div className="flex flex-col gap-4 border-s border-edge-soft ps-4">
              {replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  onDelete={onDelete}
                  onReply={onReply}
                  replyToId={replyToId}
                  signedIn={signedIn}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
