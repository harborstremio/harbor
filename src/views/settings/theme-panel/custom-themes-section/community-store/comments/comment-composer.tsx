import { useRef, useState } from "react";
import {
  Bold,
  Code,
  Eye,
  Image as ImageIcon,
  Italic,
  Link2,
  Loader2,
  Pencil,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { MAX_COMMENT_LEN, cleanCommentText, stripUnsafeUrls } from "./comment-filter";
import { CommentBody } from "./comment-render";

type WrapTag = "b" | "i" | "u" | "s" | "quote" | "code" | "url" | "img";

const TOOLS: { tag: WrapTag; icon: typeof Bold; label: string }[] = [
  { tag: "b", icon: Bold, label: "Bold" },
  { tag: "i", icon: Italic, label: "Italic" },
  { tag: "u", icon: Underline, label: "Underline" },
  { tag: "s", icon: Strikethrough, label: "Strikethrough" },
  { tag: "quote", icon: Quote, label: "Quote" },
  { tag: "code", icon: Code, label: "Code" },
  { tag: "url", icon: Link2, label: "Link" },
  { tag: "img", icon: ImageIcon, label: "Image" },
];

export function CommentComposer({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wrap = (tag: WrapTag) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = text.slice(start, end);
    const open = `[${tag}]`;
    const close = `[/${tag}]`;
    setText(text.slice(0, start) + open + sel + close + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + open.length + sel.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    setErr(null);
    const clean = cleanCommentText(text);
    if (!clean.ok) {
      setErr(clean.reason);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(clean.text);
      setText("");
      setPreview(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Could not post your comment."));
    } finally {
      setBusy(false);
    }
  };

  const over = text.length > MAX_COMMENT_LEN;

  return (
    <div className="flex flex-col gap-2 rounded-sm bg-surface p-3">
      <div className="flex items-center gap-0.5">
        {TOOLS.map(({ tag, icon: Icon, label }) => (
          <button
            key={tag}
            type="button"
            onClick={() => wrap(tag)}
            title={t(label)}
            aria-label={t(label)}
            className="grid h-8 w-8 place-items-center rounded-[4px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink active:scale-90 motion-reduce:active:scale-100"
          >
            <Icon size={16} strokeWidth={2.1} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="ms-auto flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          {preview ? <Pencil size={14} /> : <Eye size={14} />} {preview ? t("Edit") : t("Preview")}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[76px] rounded-[4px] bg-canvas p-3">
          {text.trim() ? (
            <CommentBody text={stripUnsafeUrls(text)} />
          ) : (
            <span className="text-[13px] text-ink-subtle">{t("Nothing to preview yet.")}</span>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={t(
            "Share what you think. [b]bold[/b], [img]https://...[/img], and links welcome.",
          )}
          className="min-h-[76px] resize-y rounded-[4px] bg-canvas p-3 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-edge"
        />
      )}

      <div className="flex items-center gap-3">
        {err && <span className="text-[12.5px] text-danger">{err}</span>}
        <span
          className={`ms-auto text-[11.5px] tabular-nums ${over ? "text-danger" : "text-ink-subtle"}`}
        >
          {text.length}/{MAX_COMMENT_LEN}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim() || over}
          className="flex h-9 items-center gap-1.5 rounded-sm bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] disabled:opacity-40 motion-reduce:active:scale-100"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} {t("Post")}
        </button>
      </div>
    </div>
  );
}
