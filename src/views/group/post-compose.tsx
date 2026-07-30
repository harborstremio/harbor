import { useEffect, useRef, useState } from "react";
import { Bold, Clapperboard, Eye, Image as ImageIcon, Link2, Loader2, Pencil, Send, Youtube } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAutosize } from "@/lib/use-autosize";
import { renderBbcode } from "@/lib/social/bbcode";
import { openLinkOut } from "@/lib/social/link-out";
import { createGroupPost, type GroupPost } from "@/lib/social/group-posts";
import { EmbedPrompt, type EmbedKind } from "@/components/embed-prompt";
import { MediaPicker } from "./media-picker";
import { Avatar } from "@/views/profile/profile-bits";

const MAX = 2000;

const TOOLS = [
  { icon: Bold, label: "Bold", wrap: ["[b]", "[/b]"] as const },
  { icon: Link2, label: "Link", wrap: ["[url=https://]", "[/url]"] as const },
  { icon: ImageIcon, label: "Image", embed: "img" as EmbedKind },
  { icon: Youtube, label: "YouTube", embed: "youtube" as EmbedKind },
  { icon: Clapperboard, label: "Link a title", media: true },
];

export function PostCompose({
  groupId,
  groupName,
  meAvatar,
  meAlias,
  onPosted,
  quote,
}: {
  groupId: string;
  groupName: string;
  meAvatar?: string;
  meAlias?: string;
  onPosted: (p: GroupPost) => void;
  quote?: { n: number; text: string };
}) {
  const t = useT();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [embed, setEmbed] = useState<EmbedKind | null>(null);
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const caret = useRef(0);
  const trimmed = body.trim();
  const left = MAX - body.length;
  useAutosize(boxRef, body);
  const active = focused || !!trimmed || busy || !!embed || picking;
  useEffect(() => {
    if (!quote?.n) return;
    setBody((b) => (b ? `${quote.text}${b}` : quote.text).slice(0, MAX));
    setPreview(false);
    requestAnimationFrame(() => {
      const el = boxRef.current;
      el?.focus();
      const pos = el?.value.length ?? 0;
      el?.setSelectionRange(pos, pos);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.n]);
  const splice = (start: number, end: number, text: string) => {
    setBody((b) => (b.slice(0, start) + text + b.slice(end)).slice(0, MAX));
    requestAnimationFrame(() => {
      boxRef.current?.focus();
      const pos = start + text.length;
      boxRef.current?.setSelectionRange(pos, pos);
    });
  };
  const insertEmbed = (bbcode: string) => {
    const at = Math.min(caret.current, body.length);
    const pad = at > 0 && body[at - 1] !== "\n" ? "\n" : "";
    splice(at, at, `${pad}${bbcode}\n`);
  };
  const send = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      onPosted(await createGroupPost(groupId, trimmed));
      setBody("");
    } catch (e) {
      setError((e as Error).message || t("Could not post."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-3 rounded-[14px] bg-surface p-3.5 ring-1 ring-edge-soft transition-shadow focus-within:ring-edge">
      <Avatar src={meAvatar} size={38} alias={meAlias} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <textarea
          ref={boxRef}
          value={body}
          maxLength={MAX}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          rows={1}
          placeholder={t("Share something with {group}", { group: groupName })}
          className={`harbor-scroll min-h-[38px] w-full resize-none bg-transparent py-1.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle ${preview ? "hidden" : ""}`}
        />
        {preview && (
          <div className="min-h-[38px] py-1.5">
            {trimmed ? (
              <div
                className="max-w-none break-words text-[14px] leading-relaxed text-ink-muted [&_a]:break-words"
                onClick={(e) => {
                  const a = (e.target as HTMLElement).closest?.("a");
                  const href = a?.getAttribute("href");
                  if (a && href) {
                    e.preventDefault();
                    openLinkOut(href);
                  }
                }}
                dangerouslySetInnerHTML={{ __html: renderBbcode(body) }}
              />
            ) : (
              <span className="text-[13px] text-ink-subtle">{t("Nothing to preview yet.")}</span>
            )}
          </div>
        )}
        {active && (
          <div className="flex items-center gap-0.5">
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={t(tool.label)}
                aria-label={t(tool.label)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const el = boxRef.current;
                  caret.current = el?.selectionStart ?? body.length;
                  if (tool.media) {
                    setPicking(true);
                    return;
                  }
                  if (tool.embed) {
                    setEmbed(tool.embed);
                    return;
                  }
                  if (!el || !tool.wrap) return;
                  const sel = body.slice(el.selectionStart, el.selectionEnd);
                  splice(el.selectionStart, el.selectionEnd, tool.wrap[0] + sel + tool.wrap[1]);
                }}
                className="grid h-8 w-8 place-items-center rounded-[6px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink active:scale-90 motion-reduce:active:scale-100"
              >
                <tool.icon size={15} strokeWidth={2.1} />
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPreview((v) => !v)}
              title={preview ? t("Edit") : t("Preview")}
              className="ms-auto flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-semibold text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            >
              {preview ? <Pencil size={13} /> : <Eye size={14} />} {preview ? t("Edit") : t("Preview")}
            </button>
          </div>
        )}
        {embed && <EmbedPrompt kind={embed} onInsert={insertEmbed} onClose={() => setEmbed(null)} />}
        {picking && <MediaPicker onInsert={insertEmbed} onClose={() => setPicking(false)} />}
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        {(trimmed || busy) && (
          <div className="flex items-center justify-end gap-3">
            <span className="me-auto text-[11.5px] text-ink-subtle">
              {t("BBCode works: [b] [url] [img] [youtube] [video] [quote]")}
            </span>
            <span className={`text-[11.5px] tabular-nums ${left < 100 ? "text-danger" : "text-ink-subtle"}`}>{left}</span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!trimmed || busy}
              className="flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} strokeWidth={2.4} />}
              {t("Post")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}