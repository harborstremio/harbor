import { URL_RE, safeImageUrl, safeLinkUrl } from "./safe-url";

export type CNode =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "b" | "i" | "u" | "s" | "code" | "quote"; children: CNode[] }
  | { t: "link"; href: string; label: string }
  | { t: "img"; src: string };

type Tok = { k: "text"; v: string } | { k: "open"; tag: string; arg?: string } | { k: "close"; tag: string };

type Frame = { tag: string; arg?: string; children: CNode[] };

const FMT = new Set(["b", "i", "u", "s", "code", "quote"]);

function tokenize(src: string): Tok[] {
  const re = /\[(\/?)(b|i|u|s|code|quote|url|img)(?:=([^\]]*))?\]/gi;
  const toks: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) toks.push({ k: "text", v: src.slice(last, m.index) });
    const tag = m[2].toLowerCase();
    toks.push(m[1] === "/" ? { k: "close", tag } : { k: "open", tag, arg: m[3] });
    last = re.lastIndex;
  }
  if (last < src.length) toks.push({ k: "text", v: src.slice(last) });
  return toks;
}

function textOf(nodes: CNode[]): string {
  let s = "";
  for (const n of nodes) {
    if (n.t === "text") s += n.v;
    else if (n.t === "br") s += "\n";
    else if (n.t === "link") s += n.label;
    else if (n.t === "img") s += "";
    else s += textOf(n.children);
  }
  return s;
}

function finalize(f: Frame): CNode[] {
  if (FMT.has(f.tag)) return [{ t: f.tag as "b", children: f.children }];
  if (f.tag === "url") {
    const label = textOf(f.children);
    const safe = safeLinkUrl((f.arg != null ? f.arg : label).trim());
    if (!safe) return f.children;
    return [{ t: "link", href: safe, label: label.trim() || safe }];
  }
  if (f.tag === "img") {
    const src = safeImageUrl(textOf(f.children).trim());
    return src ? [{ t: "img", src }] : [];
  }
  return f.children;
}

function pushInto(target: CNode[], parent: CNode[]): void {
  for (const n of parent) target.push(n);
}

function build(toks: Tok[]): CNode[] {
  const root: CNode[] = [];
  const stack: Frame[] = [];
  const top = () => (stack.length ? stack[stack.length - 1].children : root);
  const pushText = (v: string) => {
    const parts = v.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) top().push({ t: "br" });
      if (p) top().push({ t: "text", v: p });
    });
  };
  for (const tk of toks) {
    if (tk.k === "text") {
      pushText(tk.v);
    } else if (tk.k === "open") {
      stack.push({ tag: tk.tag, arg: tk.arg, children: [] });
    } else {
      if (!stack.some((f) => f.tag === tk.tag)) {
        pushText(`[/${tk.tag}]`);
        continue;
      }
      while (stack.length) {
        const f = stack.pop() as Frame;
        pushInto(stack.length ? stack[stack.length - 1].children : root, finalize(f));
        if (f.tag === tk.tag) break;
      }
    }
  }
  while (stack.length) {
    const f = stack.pop() as Frame;
    pushInto(stack.length ? stack[stack.length - 1].children : root, finalize(f));
  }
  return root;
}

function splitUrls(v: string): CNode[] {
  const out: CNode[] = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(v))) {
    const url = m[0];
    if (m.index > last) out.push({ t: "text", v: v.slice(last, m.index) });
    const safe = safeLinkUrl(url);
    out.push(safe ? { t: "link", href: safe, label: safe } : { t: "text", v: url });
    last = m.index + url.length;
  }
  if (last < v.length) out.push({ t: "text", v: v.slice(last) });
  return out.length ? out : [{ t: "text", v }];
}

function autolink(nodes: CNode[], inCode: boolean): CNode[] {
  const out: CNode[] = [];
  for (const n of nodes) {
    if (n.t === "text" && !inCode) out.push(...splitUrls(n.v));
    else if (n.t === "b" || n.t === "i" || n.t === "u" || n.t === "s" || n.t === "code" || n.t === "quote")
      out.push({ ...n, children: autolink(n.children, inCode || n.t === "code") });
    else out.push(n);
  }
  return out;
}

export function parseComment(text: string): CNode[] {
  return autolink(build(tokenize(text)), false);
}
