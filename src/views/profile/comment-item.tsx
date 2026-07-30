import { Heart, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { segmentMentions } from "@/lib/social/mentions";
import { Avatar, timeAgo } from "./profile-bits";
import { MentionLink } from "./mention-link";
import { segmentProfanity } from "./text-safety";
import { UserHoverCard } from "./user-hover-card";
import { useSelfAvatar } from "./use-self-avatar";
import type { Comment } from "./profile-types";
import { VerifiedBadge } from "@/views/account/verified-badge";

function SafeBody({ body, onOpenAuthor }: { body: string; onOpenAuthor?: (handle: string) => void }) {
  const t = useT();
  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-muted">
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
}: {
  c: Comment;
  canDelete: boolean;
  signedIn?: boolean;
  onDelete: (id: string) => void;
  onToggleLike?: (id: string) => void;
  onOpenAuthor?: (handle: string) => void;
}) {
  const t = useT();
  const self = useSelfAvatar();
  const mine = !!self.handle && self.handle.toLowerCase() === c.authorHandle.toLowerCase();
  const avatarSrc = mine ? self.avatar ?? c.authorAvatarUrl : c.authorAvatarUrl;
  const avatarFallback = mine ? c.authorAvatarUrl : undefined;
  return (
    <div className="group flex gap-3 rounded-[10px] p-2 transition-colors hover:bg-elevated/60">
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
        <div className="mt-1.5">
          <button
            onClick={() => onToggleLike?.(c.id)}
            disabled={!signedIn}
            aria-pressed={!!c.liked}
            aria-label={c.liked ? t("Unlike comment") : t("Like comment")}
            className={`-ml-2 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] tabular-nums transition-colors disabled:cursor-default ${
              c.liked ? "text-danger" : `text-ink-subtle ${signedIn ? "hover:text-ink-muted" : ""}`
            } ${signedIn ? "hover:bg-elevated/70" : ""}`}
          >
            <Heart size={15} className={c.liked ? "fill-current" : ""} />
            {(c.likeCount ?? 0) > 0 && <span>{c.likeCount}</span>}
          </button>
        </div>
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(c.id)}
          aria-label={t("Delete comment")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-subtle opacity-0 transition-all hover:bg-surface hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={20} />
        </button>
      )}
    </div>
  );
}
