import { Fragment, useMemo, type ReactNode } from "react";
import { PersonLink } from "../person-link";
import type { PersonRef } from "./types";
import { escapeRx } from "./utils";

type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "italic"; children: InlineNode[] }
  | { kind: "bold"; children: InlineNode[] }
  | { kind: "br" };

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  const len = src.length;
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ kind: "text", value: decodeEntities(buf) });
      buf = "";
    }
  };
  while (i < len) {
    const rest = src.slice(i);
    const brMatch = /^<br\s*\/?>/i.exec(rest);
    if (brMatch) {
      flush();
      out.push({ kind: "br" });
      i += brMatch[0].length;
      continue;
    }
    const emMatch = /^<em>([\s\S]*?)<\/em>/i.exec(rest);
    if (emMatch) {
      flush();
      out.push({ kind: "italic", children: parseInline(emMatch[1]) });
      i += emMatch[0].length;
      continue;
    }
    const iMatch = /^<i>([\s\S]*?)<\/i>/i.exec(rest);
    if (iMatch) {
      flush();
      out.push({ kind: "italic", children: parseInline(iMatch[1]) });
      i += iMatch[0].length;
      continue;
    }
    const strongMatch = /^<strong>([\s\S]*?)<\/strong>/i.exec(rest);
    if (strongMatch) {
      flush();
      out.push({ kind: "bold", children: parseInline(strongMatch[1]) });
      i += strongMatch[0].length;
      continue;
    }
    const bMatch = /^<b>([\s\S]*?)<\/b>/i.exec(rest);
    if (bMatch) {
      flush();
      out.push({ kind: "bold", children: parseInline(bMatch[1]) });
      i += bMatch[0].length;
      continue;
    }
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: "bold", children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (src[i] === "*") {
      const end = src.indexOf("*", i + 1);
      if (end > i + 1 && !/\s/.test(src[i + 1])) {
        flush();
        out.push({ kind: "italic", children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (src[i] === "_") {
      const prev = i === 0 ? " " : src[i - 1];
      const end = src.indexOf("_", i + 1);
      const next = end >= 0 ? src[end + 1] ?? " " : " ";
      if (end > i + 1 && /[\s.,!?;:"')\]]/.test(prev) && /[\s.,!?;:"'(\[]/.test(next)) {
        flush();
        out.push({ kind: "italic", children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buf += src[i];
    i += 1;
  }
  flush();
  return out;
}

function buildNameIndex(people: PersonRef[]): { rx: RegExp | null; nameToId: Map<string, number> } {
  if (people.length === 0) return { rx: null, nameToId: new Map() };
  const nameToId = new Map<string, number>();

  for (const p of people) {
    if (!nameToId.has(p.name)) nameToId.set(p.name, p.id);
  }

  const lastNameCount = new Map<string, number>();
  const lastNameOwner = new Map<string, number>();
  for (const p of people) {
    const parts = p.name.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const last = parts[parts.length - 1];
    if (last.length < 3) continue;
    lastNameCount.set(last, (lastNameCount.get(last) ?? 0) + 1);
    if (!lastNameOwner.has(last)) lastNameOwner.set(last, p.id);
  }
  for (const [last, count] of lastNameCount) {
    if (count !== 1) continue;
    if (nameToId.has(last)) continue;
    nameToId.set(last, lastNameOwner.get(last)!);
  }

  const ordered = [...nameToId.keys()].sort((a, b) => b.length - a.length);
  const pattern = ordered.map(escapeRx).join("|");
  const rx = new RegExp(`\\b(${pattern})\\b`, "g");
  return { rx, nameToId };
}

const QUOTE_SPLIT = /("[^"]*"|“[^”]*”)/;

function renderText(
  text: string,
  rx: RegExp | null,
  nameToId: Map<string, number>,
  onPersonClick: (id: number) => void,
  keyBase: string,
): ReactNode {
  if (!rx) return text;
  return text.split(QUOTE_SPLIT).map((seg, si) => {
    if (si % 2 === 1) return <Fragment key={`${keyBase}-q${si}`}>{seg}</Fragment>;
    return (
      <Fragment key={`${keyBase}-s${si}`}>
        {seg.split(rx).map((part, i) => {
          const id = nameToId.get(part);
          if (id == null) return <Fragment key={`${keyBase}-${si}-${i}`}>{part}</Fragment>;
          return (
            <PersonLink
              key={`${keyBase}-${si}-${i}`}
              id={id}
              name={part}
              onClick={onPersonClick}
              className="font-medium not-italic text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
            />
          );
        })}
      </Fragment>
    );
  });
}

function renderNodes(
  nodes: InlineNode[],
  rx: RegExp | null,
  nameToId: Map<string, number>,
  onPersonClick: (id: number) => void,
  keyBase = "n",
): ReactNode {
  return nodes.map((node, idx) => {
    const key = `${keyBase}-${idx}`;
    if (node.kind === "br") return <br key={key} />;
    if (node.kind === "text") {
      return <Fragment key={key}>{renderText(node.value, rx, nameToId, onPersonClick, key)}</Fragment>;
    }
    if (node.kind === "italic") {
      return (
        <em key={key} className="italic">
          {renderNodes(node.children, rx, nameToId, onPersonClick, key)}
        </em>
      );
    }
    return (
      <strong key={key} className="font-semibold text-ink">
        {renderNodes(node.children, rx, nameToId, onPersonClick, key)}
      </strong>
    );
  });
}

export function LinkedReview({
  text,
  people,
  onPersonClick,
}: {
  text: string;
  people: PersonRef[];
  onPersonClick: (id: number) => void;
}) {
  const { rx, nameToId } = useMemo(() => buildNameIndex(people), [people]);
  const nodes = useMemo(() => parseInline(text), [text]);
  return <>{renderNodes(nodes, rx, nameToId, onPersonClick)}</>;
}
