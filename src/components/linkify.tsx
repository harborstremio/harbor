import { Fragment, type ReactNode } from "react";
import { openLinkOut } from "@/lib/social/link-out";

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function normalize(raw: string): string {
  const clean = raw.replace(/[.,!?)\]}"']+$/, "");
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

export function Linkify({ text }: { text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  URL_RE.lastIndex = 0;
  for (let m = URL_RE.exec(text); m; m = URL_RE.exec(text)) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const raw = m[0];
    nodes.push(
      <button
        key={key++}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openLinkOut(normalize(raw));
        }}
        className="break-all text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
      >
        {raw}
      </button>,
    );
    last = m.index + raw.length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}
