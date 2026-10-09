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
} from "../../../../icons";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "@/views/settings/kit";
import { RowNote } from "@/views/settings/shared";
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

  const wrap = (tag: WrapTag, viaNav: boolean) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = text.slice(start, end);
    const open = `[${tag}]`;
    const close = `[/${tag}]`;
    setText(text.slice(0, start) + open + sel + close + text.slice(end));
    requestAnimationFrame(() => {
      if (viaNav) tvFocus(el);
      else el.focus();
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
      <div className="flex flex-wrap items-center gap-0.5">
        {TOOLS.map(({ tag, icon: Icon, label }) => (
          <button
            key={tag}
            type="button"
            onClick={(e) => wrap(tag, navOwnsFocus(e.currentTarget))}
            title={t(label)}
            aria-label={t(label)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink active:scale-90 motion-reduce:active:scale-100"
          >
            <Icon size={18} strokeWidth={2.1} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={`ms-auto ${ROW_ACTION}`}
        >
          {preview ? <Pencil size={18} /> : <Eye size={18} />} {preview ? t("Edit") : t("Preview")}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[88px] rounded-[8px] bg-canvas p-3">
          {text.trim() ? (
            <CommentBody text={stripUnsafeUrls(text)} />
          ) : (
            <span className="text-[15.5px] leading-[22px] text-ink-subtle">
              {t("Nothing to preview yet.")}
            </span>
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
          className="min-h-[88px] resize-y rounded-[8px] bg-canvas p-3 text-[15.5px] font-normal leading-[22px] tracking-[-0.02px] text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-1 focus:ring-edge"
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {err && <RowNote>{err}</RowNote>}
        <span
          className={`ms-auto text-[15.5px] leading-[22px] tabular-nums ${over ? "text-danger" : "text-ink-subtle"}`}
        >
          {text.length}/{MAX_COMMENT_LEN}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim() || over}
          className={ROW_ACTION_PRIMARY}
        >
          {busy && <Loader2 size={18} className="animate-spin" />} {t("Post")}
        </button>
      </div>
    </div>
  );
}
