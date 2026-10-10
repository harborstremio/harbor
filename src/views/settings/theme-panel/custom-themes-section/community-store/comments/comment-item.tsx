import { useState } from "react";
import { ChevronDown, Loader2, Reply as ReplyIcon, Trash2 } from "../../../../icons";
import { useT } from "@/lib/i18n";
import type { ThemeComment } from "@/lib/theme-store";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { Avatar } from "@/views/profile/profile-bits";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { ROW_ACTION, ROW_ACTION_DANGER } from "@/views/settings/kit";
import { ROW_TITLE } from "@/views/settings/shared";
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
  const displayName = comment.author || t("Anonymous");
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
        aria-label={t("Open {name} profile", { name: displayName })}
        className="grid h-11 w-11 shrink-0 place-items-center"
      >
        <Avatar src={comment.authorAvatar ?? undefined} size={44} alias={displayName} />
      </button>
    </UserHoverCard>
  ) : (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[16.5px] font-bold text-white ring-1 ring-white/15"
      style={{ background: `oklch(0.58 0.15 ${hue})` }}
    >
      {(displayName.trim()[0] || "?").toUpperCase()}
    </span>
  );

  const nameEl = handle ? (
    <UserHoverCard handle={handle}>
      <button
        type="button"
        onClick={() => requestOpenProfile(handle)}
        className={`truncate ${ROW_TITLE} transition-colors hover:text-accent`}
      >
        {displayName}
      </button>
    </UserHoverCard>
  ) : (
    <span className={`truncate ${ROW_TITLE}`}>{displayName}</span>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {avatarEl}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {nameEl}
            {handle && (
              <span className="shrink-0 font-display text-[15.5px] leading-[22px] text-ink-subtle">
                @{handle}
              </span>
            )}
            <span className="shrink-0 text-[15.5px] leading-[22px] text-ink-subtle">
              {timeAgo(comment.createdAt)}
            </span>
            {comment.canDelete && (
              <button
                type="button"
                onClick={del}
                disabled={busy}
                aria-label={t("Remove comment")}
                className={`ms-auto ${ROW_ACTION_DANGER} ${confirm ? "border-danger/40 text-danger" : ""}`}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {confirm && t("Remove?")}
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
                className={ROW_ACTION}
              >
                <ReplyIcon size={18} /> {replying ? t("Cancel") : t("Reply")}
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
        <div className="ms-14 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            aria-expanded={showReplies}
            className={`w-fit ${ROW_ACTION}`}
          >
            <ChevronDown
              size={18}
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
