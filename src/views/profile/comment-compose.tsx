import { Send } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAutosize } from "@/lib/use-autosize";
import { MAX_MENTIONS, scanMentions } from "@/lib/social/mentions";
import type { Friend } from "@/lib/social/friends";
import { MentionPicker, useMentionSuggest } from "./mention-picker";
import { COMMENT_MAX, type ComposeIssue } from "./text-safety";

const ISSUE_TEXT: Record<Exclude<ComposeIssue, null>, string> = {
  empty: "Say something first",
  url: "Links are not allowed in comments",
  spam: "That looks like spam, try rephrasing",
  "too-long": `Keep it under ${COMMENT_MAX} characters`,
  cooldown: "Slow down a moment before posting again",
  failed: "Couldn't post right now, try again",
  signin: "Sign in to comment",
};

export function CommentCompose({
  onSubmit,
  sending,
  disabled,
}: {
  onSubmit: (raw: string) => Promise<ComposeIssue>;
  sending: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [issue, setIssue] = useState<ComposeIssue>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const remaining = COMMENT_MAX - text.length;
  const overCap = scanMentions(text).ignored.length > 0;
  const suggest = useMentionSuggest(text, caret);
  useAutosize(boxRef, text);

  const send = async () => {
    if (sending) return;
    const result = await onSubmit(text);
    setIssue(result);
    if (!result) setText("");
  };

  const pick = (friend: Friend) => {
    if (!suggest.token) return;
    const { start } = suggest.token;
    setText(`${text.slice(0, start)}@${friend.handle} ${text.slice(caret)}`);
    const pos = start + friend.handle.length + 2;
    setCaret(pos);
    requestAnimationFrame(() => {
      boxRef.current?.focus();
      boxRef.current?.setSelectionRange(pos, pos);
    });
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
      <MentionPicker suggest={suggest} onPick={pick} />
      <textarea
        ref={boxRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          if (issue) setIssue(null);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            void send();
            return;
          }
          if (!suggest.open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            suggest.move(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(suggest.options[suggest.index]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            suggest.dismiss();
          }
        }}
        rows={1}
        maxLength={COMMENT_MAX + 40}
        aria-autocomplete="list"
        aria-expanded={suggest.open}
        placeholder={t("Leave a comment. No links.")}
        className="harbor-scroll min-h-[52px] w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle"
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <span className="text-[12px] text-ink-subtle">
          {issue ? (
            <span className="text-danger">{t(ISSUE_TEXT[issue])}</span>
          ) : overCap ? (
            <span className="text-amber-300">
              {t("Only the first {max} people you mention get notified.", { max: MAX_MENTIONS })}
            </span>
          ) : (
            t("{count} left", { count: remaining })
          )}
        </span>
        <button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send size={20} /> {sending ? t("Posting") : t("Post")}
        </button>
      </div>
    </div>
  );
}
