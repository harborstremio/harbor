import type { HNode } from "./types";

const MAX_NODES = 60_000;
const MAX_DEPTH = 200;

const DROP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
]);

type Budget = { n: number };

function serializeEl(el: Element, depth: number, budget: Budget): HNode {
  const a: Record<string, string> = {};
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const at = attrs[i];
    a[at.name] = at.value;
  }
  const c: HNode[] = [];
  if (depth < MAX_DEPTH) {
    const kids = el.childNodes;
    for (let i = 0; i < kids.length; i++) {
      if (budget.n >= MAX_NODES) break;
      const k = kids[i];
      if (k.nodeType === 1) {
        const child = k as Element;
        if (DROP_TAGS.has(child.tagName.toLowerCase())) continue;
        budget.n++;
        c.push(serializeEl(child, depth + 1, budget));
      } else if (k.nodeType === 3) {
        const text = k.nodeValue || "";
        if (text.trim()) {
          budget.n++;
          c.push({ x: text });
        }
      }
    }
  }
  return { t: el.tagName.toLowerCase(), a, x: "", c };
}

export function serializeHtml(html: string): HNode {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  if (!body) return { t: "body", a: {}, x: "", c: [] };
  return serializeEl(body, 0, { n: 0 });
}
