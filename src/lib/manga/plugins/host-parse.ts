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

function hiddenElements(doc: Document): Set<Element> {
  const hidden = new Set<Element>();
  const rules = Array.from(doc.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n")
    .matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const [, selectors, declarations] of rules) {
    if (
      !/(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden|text-indent\s*:\s*-\d{3,}|(?:top|right|bottom|left)\s*:\s*-\d{3,}px)/i.test(
        declarations,
      )
    )
      continue;
    for (const selector of selectors.split(",")) {
      try {
        doc.querySelectorAll(selector.trim()).forEach((element) => hidden.add(element));
      } catch {
        /* unsupported selector */
      }
    }
  }
  return hidden;
}

function serializeEl(el: Element, depth: number, budget: Budget, hidden: Set<Element>): HNode {
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
        if (DROP_TAGS.has(child.tagName.toLowerCase()) || hidden.has(child)) continue;
        budget.n++;
        c.push(serializeEl(child, depth + 1, budget, hidden));
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
  return serializeEl(body, 0, { n: 0 }, hiddenElements(doc));
}
