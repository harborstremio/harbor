import { Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAutosize } from "@/lib/use-autosize";
import { MentionPopover } from "./mention-popover";
import { COMMENT_MAX, activeMentionQuery, type ComposeIssue } from "./text-safety";
import { useMentionSuggest, type MentionHit } from "./use-mention-suggest";
import type { Friend, ReplyTarget } from "./profile-types";

const ISSUE_TEXT: Record<Exclude<ComposeIssue, null>, string> = {
  empty: "Say something first",
  url: "Links are not allowed in comments",
  spam: "That looks like spam, try rephrasing",
  "too-long": `Keep it under ${COMMENT_MAX} characters`,
  cooldown: "Slow down a moment before posting again",
};

export function CommentCompose({
  onSubmit,
  sending,
  disabled,
  replyTo,
  onCancelReply,
  friends = [],
}: {
  onSubmit: (raw: string) => Promise<ComposeIssue>;
  sending: boolean;
  disabled?: boolean;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  friends?: Friend[];
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [issue, setIssue] = useState<ComposeIssue>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const remaining = COMMENT_MAX - text.length;
  const hits = useMentionSuggest(mention?.query ?? null, friends);
  useAutosize(boxRef, text);

  const sync = (el: HTMLTextAreaElement) => {
    const next = activeMentionQuery(el.value, el.selectionStart ?? 0);
    setMention(next);
    setActive(0);
  };

  const pick = (hit: MentionHit) => {
    if (!mention) return;
    const el = boxRef.current;
    const end = mention.start + 1 + mention.query.length;
    const next = `${text.slice(0, mention.start)}@${hit.handle} ${text.slice(end)}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = mention.start + hit.handle.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const send = async () => {
    if (sending) return;
    const result = await onSubmit(text);
    setIssue(result);
    if (!result) {
      setText("");
      setMention(null);
      onCancelReply?.();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && hits.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % hits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + hits.length) % hits.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(hits[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      onCancelReply?.();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
  };

  if (disabled) {
    return (
      <div className="rounded-[10px] border border-dashed border-edge px-4 py-3 text-center text-[13px] text-ink-subtle">
        {t("Sign in to leave a comment")}
      </div>
    );
  }

  return (
    <div className="relative rounded-[10px] bg-elevated p-2 ring-1 ring-edge-soft focus-within:ring-edge">
      {replyTo && (
        <div className="mb-1 flex items-start gap-2 rounded-[8px] border-s-2 border-accent bg-surface/60 px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[12px] font-semibold text-ink">
              {t("Replying to {alias}", { alias: replyTo.alias })}
            </span>
            <p className="truncate text-[12px] text-ink-subtle">{replyTo.excerpt}</p>
          </div>
          <button
            onClick={() => onCancelReply?.()}
            aria-label={t("Cancel reply")}
            className="shrink-0 rounded-[6px] p-1 text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <MentionPopover hits={hits} active={active} onPick={pick} />

      <textarea
        ref={boxRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          sync(e.currentTarget);
          if (issue) setIssue(null);
        }}
        onKeyUp={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onBlur={() => window.setTimeout(() => setMention(null), 120)}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={COMMENT_MAX + 40}
        placeholder={replyTo ? t("Write a reply. Use @ to mention.") : t("Leave a comment. No links.")}
        className="harbor-scroll min-h-[52px] w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle"
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <span className="text-[12px] text-ink-subtle">
          {issue ? <span className="text-danger">{t(ISSUE_TEXT[issue])}</span> : t("{count} left", { count: remaining })}
        </span>
        <button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send size={20} /> {sending ? t("Posting") : t(replyTo ? "Reply" : "Post")}
        </button>
      </div>
    </div>
  );
}