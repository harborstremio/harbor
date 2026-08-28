import { useMemo } from "react";
import { handleLinkOutActivation } from "@/lib/social/link-out-activation";
import { openLinkOut } from "@/lib/social/link-out";
import { useT } from "@/lib/i18n";
import { segmentMentions } from "@/lib/social/mentions";
import { MentionLink } from "@/views/profile/mention-link";
import { segmentProfanity } from "@/views/profile/text-safety";
import { parseComment, type CNode } from "./bbcode";

function TextRun({ v }: { v: string }) {
  const t = useT();
  return (
    <>
      {segmentMentions(v).map((seg, i) =>
        seg.handle ? (
          <MentionLink key={i} handle={seg.handle} label={seg.text} />
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
    </>
  );
}

function render(nodes: CNode[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <TextRun key={i} v={n.v} />;
      case "br":
        return <br key={i} />;
      case "b":
        return (
          <strong key={i} className="font-semibold text-ink">
            {render(n.children)}
          </strong>
        );
      case "i":
        return <em key={i}>{render(n.children)}</em>;
      case "u":
        return (
          <span key={i} className="underline underline-offset-2">
            {render(n.children)}
          </span>
        );
      case "s":
        return (
          <span key={i} className="line-through opacity-80">
            {render(n.children)}
          </span>
        );
      case "code":
        return (
          <code
            key={i}
            className="rounded-[6px] bg-canvas/70 px-1.5 py-0.5 font-mono text-[12.5px] text-ink ring-1 ring-edge-soft"
          >
            {render(n.children)}
          </code>
        );
      case "quote":
        return (
          <blockquote key={i} className="my-1.5 border-s-2 border-edge ps-3 text-ink-muted">
            {render(n.children)}
          </blockquote>
        );
      case "link":
        return (
          <a
            key={i}
            href={n.href}
            title={n.href}
            rel="noreferrer noopener nofollow"
            onClick={(e) => handleLinkOutActivation(e, openLinkOut)}
            onAuxClick={(e) => handleLinkOutActivation(e, openLinkOut)}
            className="break-all text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
          >
            {n.label}
          </a>
        );
      case "img":
        return (
          <img
            key={i}
            src={n.src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            className="my-1.5 block max-h-72 max-w-full rounded-[10px] border border-edge-soft object-contain"
          />
        );
    }
  });
}

export function CommentBody({ text }: { text: string }) {
  const nodes = useMemo(() => parseComment(text), [text]);
  return (
    <div className="break-words text-[13.5px] leading-relaxed text-ink-muted [word-break:break-word]">
      {render(nodes)}
    </div>
  );
}
