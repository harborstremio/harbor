const MAX_DEPTH = 12;
const MAX_EMBEDS = 8;
const MAX_INPUT = 20000;
const INVISIBLE_RE = /[\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const LI = "\uE000";

const COLOR_NAMES = new Set([
  "red", "orange", "yellow", "green", "teal", "cyan", "blue", "indigo", "violet",
  "purple", "pink", "magenta", "brown", "gray", "grey", "black", "white", "gold",
  "silver", "crimson", "coral", "salmon", "lime", "olive", "navy", "maroon",
]);

const SPAM_HOSTS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "buff.ly", "is.gd",
  "cutt.ly", "rebrand.ly", "shorturl.at", "rb.gy", "adf.ly", "grabify.link",
  "iplogger.org", "iplogger.com", "blasze.tk",
]);

const SIZE_EM = ["0.85", "0.85", "1", "1.15", "1.4", "1.7", "2.1", "2.6"];

const TAG_RE =
  /\[(\/?)(b|i|u|s|h|quote|code|list|color|size|url|img|youtube|spotify|video|media)(?:=([^\]\n]*))?\]|(\[\*\])/gi;

type Tok =
  | { k: "text"; v: string }
  | { k: "open"; tag: string; arg?: string }
  | { k: "close"; tag: string }
  | { k: "li" };

type Frame = { tag: string; arg?: string; html: string[]; raw: string[] };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSpamHost(host: string): boolean {
  return SPAM_HOSTS.has(host.toLowerCase().replace(/^www\./, ""));
}

function httpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!/^https:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol.toLowerCase() !== "https:") return null;
    if (isSpamHost(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function linkUrl(raw: string): string | null {
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    const s = u.protocol.toLowerCase();
    if (s !== "http:" && s !== "https:") return null;
    if (isSpamHost(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function colorValue(arg: string): string | null {
  const t = arg.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(t) || /^#[0-9a-f]{6}$/.test(t)) return t;
  if (COLOR_NAMES.has(t)) return t;
  return null;
}

export function ytId(raw: string): string | null {
  const t = raw.trim();
  const ok = (id: string) => (/^[A-Za-z0-9_-]{11}$/.test(id) ? id : null);
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return ok(u.pathname.slice(1).split("/")[0]);
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v) return ok(v);
      const m = u.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return ok(m[1]);
    }
  } catch {
    return null;
  }
  return null;
}

export function spotifyEmbed(raw: string): { type: string; id: string } | null {
  const t = raw.trim();
  const types = new Set(["track", "album", "playlist", "artist", "episode", "show"]);
  const uri = t.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/i);
  if (uri) return { type: uri[1].toLowerCase(), id: uri[2] };
  try {
    const u = new URL(t);
    if (u.hostname.replace(/^www\./, "") !== "open.spotify.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => types.has(p.toLowerCase()));
    if (idx >= 0 && parts[idx + 1]) {
      const id = parts[idx + 1].split("?")[0];
      if (/^[A-Za-z0-9]+$/.test(id)) return { type: parts[idx].toLowerCase(), id };
    }
  } catch {
    return null;
  }
  return null;
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let last = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(src))) {
    if (m.index > last) toks.push({ k: "text", v: src.slice(last, m.index) });
    if (m[4]) {
      toks.push({ k: "li" });
    } else {
      const tag = m[2].toLowerCase();
      toks.push(m[1] === "/" ? { k: "close", tag } : { k: "open", tag, arg: m[3] });
    }
    last = TAG_RE.lastIndex;
  }
  if (last < src.length) toks.push({ k: "text", v: src.slice(last) });
  return toks;
}

function ytEmbedSrc(id: string): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
  });
  const proto = typeof window !== "undefined" ? (window.location?.protocol ?? "") : "";
  if (/^https?:$/.test(proto) && window.location?.origin) params.set("origin", window.location.origin);
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

function iframe(src: string, title: string): string {
  return (
    `<div style="position:relative;width:100%;aspect-ratio:16/9;margin:10px 0;border-radius:12px;overflow:hidden;background:#000">` +
    `<iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allowfullscreen ` +
    `allow="encrypted-media;picture-in-picture;clipboard-write;fullscreen" ` +
    `referrerpolicy="strict-origin-when-cross-origin" ` +
    `style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div>`
  );
}

function spotifyIframe(src: string): string {
  return (
    `<div style="width:100%;max-width:640px;height:152px;margin:10px 0;border-radius:12px;overflow:hidden">` +
    `<iframe src="${esc(src)}" title="Spotify" loading="lazy" allowtransparency="true" ` +
    `allow="encrypted-media;clipboard-write" ` +
    `sandbox="allow-scripts allow-same-origin allow-presentation" ` +
    `style="display:block;width:100%;height:152px;border:0;border-radius:12px;background:transparent"></iframe></div>`
  );
}

const MEDIA_CARD_STYLE =
  "display:flex;align-items:center;gap:10px;margin:8px 0;padding:8px;border-radius:12px;" +
  "background:var(--color-elevated);box-shadow:inset 0 0 0 1px var(--color-edge-soft);" +
  "max-width:340px;cursor:pointer;text-decoration:none";

const MEDIA_KIND: Record<string, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
};

export function mediaTag(id: string, kind: string, title: string, poster?: string): string {
  const clean = (s: string) => s.replace(/[|[\]]/g, "").trim();
  return `[media]${clean(id)}|${clean(kind)}|${clean(title).slice(0, 120)}|${clean(poster ?? "")}[/media]`;
}

function mediaHtml(raw: string): string | null {
  const [id, kind, title, poster] = raw.split("|").map((s) => s.trim());
  if (!id || !title) return null;
  const label = MEDIA_KIND[kind] ?? "Title";
  const art = poster && /^https:\/\/[^\s<>"']+$/i.test(poster) ? poster : null;
  const thumb = art
    ? `<img src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer" ` +
      `style="width:44px;height:66px;border-radius:8px;object-fit:cover;flex:0 0 auto;display:block" />`
    : `<span style="width:44px;height:66px;border-radius:8px;flex:0 0 auto;display:block;background:var(--color-raised)"></span>`;
  return (
    `<span data-harbor-media="${esc(id)}" data-harbor-media-kind="${esc(kind || "movie")}" data-harbor-media-title="${esc(title)}" data-harbor-media-poster="${esc(art ?? "")}" role="button" tabindex="0" style="${MEDIA_CARD_STYLE}">` +
    thumb +
    `<span style="min-width:0;display:flex;flex-direction:column;gap:2px">` +
    `<span style="font-size:0.82em;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-ink-subtle)">${esc(label)}</span>` +
    `<span style="font-weight:600;color:var(--color-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</span>` +
    `</span></span>`
  );
}

function embedHtml(tag: string, raw: string): string | null {
  if (tag === "media") return mediaHtml(raw);
  if (tag === "img") {
    const src = httpsUrl(raw);
    return src
      ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" ` +
          `style="max-width:100%;height:auto;border-radius:12px;margin:8px 0;display:block" />`
      : null;
  }
  if (tag === "video") {
    const src = httpsUrl(raw);
    return src
      ? `<video controls preload="metadata" src="${esc(src)}" ` +
          `style="max-width:100%;border-radius:12px;margin:10px 0;display:block"></video>`
      : null;
  }
  if (tag === "youtube") {
    const id = ytId(raw);
    return id ? iframe(ytEmbedSrc(id), "YouTube video") : null;
  }
  if (tag === "spotify") {
    const s = spotifyEmbed(raw);
    return s ? spotifyIframe(`https://open.spotify.com/embed/${s.type}/${s.id}`) : null;
  }
  return null;
}

const HEAD_STYLE = "margin:14px 0 6px;font-weight:700;font-size:1.25em;line-height:1.3;color:var(--color-ink)";
const QUOTE_STYLE =
  "margin:10px 0;padding:6px 0 6px 14px;border-left:3px solid var(--color-edge);color:var(--color-ink-muted)";
const CODE_STYLE =
  "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em;background:var(--color-elevated);" +
  "border-radius:6px;padding:1px 5px";
const LIST_STYLE = "margin:8px 0;padding-inline-start:22px;list-style:disc";
const LINK_STYLE = "color:var(--color-accent);text-decoration:underline";
const MENTION_STYLE = "color:var(--color-accent);font-weight:600;cursor:pointer";

function trimBr(s: string): string {
  return s.replace(/^(?:<br\/>)+/, "").replace(/(?:<br\/>)+$/, "").trim();
}

const HANDLE_RE = /^[a-z0-9_][a-z0-9_.-]{1,31}$/i;
const INLINE_RE = /(https?:\/\/[^\s<>"']+)|@([a-z0-9_][a-z0-9_.-]{1,31})/gi;

function mentionHtml(handle: string): string {
  return (
    `<span data-harbor-mention="${esc(handle)}" role="button" tabindex="0" style="${MENTION_STYLE}">` +
    `@${esc(handle)}</span>`
  );
}

export function extractMentions(body: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(INLINE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1] || !m[2]) continue;
    const h = m[2].replace(/[.-]+$/, "").toLowerCase();
    if (HANDLE_RE.test(h)) out.add(h);
  }
  return [...out].slice(0, 20);
}

function linkifyEscaped(s: string): string {
  let out = "";
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(s))) {
    out += esc(s.slice(last, m.index));
    if (m[1]) {
      let raw = m[1];
      let trail = "";
      while (/[.,;:!?)\]}'"]$/.test(raw)) {
        trail = raw.slice(-1) + trail;
        raw = raw.slice(0, -1);
      }
      const href = linkUrl(raw);
      out += href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow" style="${LINK_STYLE}">${esc(raw)}</a>${esc(trail)}`
        : esc(m[0]);
    } else {
      const prev = m.index > 0 ? s[m.index - 1] : "";
      let h = m[2];
      let trail = "";
      while (/[.-]$/.test(h)) {
        trail = h.slice(-1) + trail;
        h = h.slice(0, -1);
      }
      out += /[a-z0-9_@/]/i.test(prev) || !HANDLE_RE.test(h)
        ? esc(m[0])
        : mentionHtml(h) + esc(trail);
    }
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out;
}

function wrapList(inner: string): string {
  const items = inner
    .split(LI)
    .map((p) => trimBr(p))
    .filter(Boolean);
  if (!items.length) return "";
  return `<ul style="${LIST_STYLE}">` + items.map((i) => `<li style="margin:2px 0">${i}</li>`).join("") + `</ul>`;
}

function finalize(f: Frame, addEmbed: () => boolean): { html: string; raw: string } {
  const inner = f.html.join("");
  const raw = f.raw.join("");
  const wrap = (h: string) => ({ html: h, raw });
  switch (f.tag) {
    case "b":
      return wrap(`<strong>${inner}</strong>`);
    case "i":
      return wrap(`<em>${inner}</em>`);
    case "u":
      return wrap(`<span style="text-decoration:underline">${inner}</span>`);
    case "s":
      return wrap(`<span style="text-decoration:line-through">${inner}</span>`);
    case "h":
      return wrap(`<div style="${HEAD_STYLE}">${trimBr(inner)}</div>`);
    case "quote":
      return wrap(`<blockquote style="${QUOTE_STYLE}">${trimBr(inner)}</blockquote>`);
    case "code":
      return wrap(`<code style="${CODE_STYLE}">${inner}</code>`);
    case "list":
      return wrap(wrapList(inner));
    case "color": {
      const c = f.arg != null ? colorValue(f.arg) : null;
      return wrap(c ? `<span style="color:${c}">${inner}</span>` : inner);
    }
    case "size": {
      const n = f.arg != null ? Math.max(1, Math.min(7, Math.round(Number(f.arg)))) : NaN;
      return wrap(Number.isFinite(n) ? `<span style="font-size:${SIZE_EM[n]}em">${inner}</span>` : inner);
    }
    case "url": {
      const href = linkUrl((f.arg != null ? f.arg : raw).trim());
      if (!href) return wrap(inner);
      const label = f.arg != null ? inner || esc(href) : esc(href);
      return wrap(
        `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow" style="${LINK_STYLE}">${label}</a>`,
      );
    }
    case "img":
    case "video":
    case "youtube":
    case "spotify":
    case "media": {
      if (!addEmbed()) return wrap(esc(raw.trim()));
      const html = embedHtml(f.tag, raw);
      return wrap(html ?? esc(raw.trim()));
    }
  }
  return wrap(inner);
}

function pushText(top: Frame, v: string, linkify = false): void {
  const norm = v.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
  const parts = norm.split("\n");
  parts.forEach((p, i) => {
    if (i > 0) top.html.push("<br/>");
    top.raw.push(i > 0 ? "\n" : "");
    if (p) {
      top.html.push(linkify ? linkifyEscaped(p) : esc(p));
      top.raw.push(p);
    }
  });
}

export function renderBbcode(input: string): string {
  const src = (input || "").replace(INVISIBLE_RE, "").slice(0, MAX_INPUT);
  if (!src) return "";
  const root: Frame = { tag: "", html: [], raw: [] };
  const stack: Frame[] = [];
  const top = () => (stack.length ? stack[stack.length - 1] : root);
  let embeds = 0;
  const addEmbed = () => (embeds < MAX_EMBEDS ? (embeds++, true) : false);
  const inList = () => stack.some((f) => f.tag === "list");
  const literal = (tag: string, arg?: string) => `[${arg != null ? `${tag}=${arg}` : tag}]`;

  for (const tk of tokenize(src)) {
    if (tk.k === "text") {
      pushText(top(), tk.v, !stack.some((f) => f.tag === "url" || f.tag === "code"));
    } else if (tk.k === "li") {
      if (inList()) {
        top().html.push(LI);
        top().raw.push("");
      } else {
        pushText(top(), "[*]");
      }
    } else if (tk.k === "open") {
      if (stack.length >= MAX_DEPTH) {
        pushText(top(), literal(tk.tag, tk.arg));
        continue;
      }
      stack.push({ tag: tk.tag, arg: tk.arg, html: [], raw: [] });
    } else {
      if (!stack.some((f) => f.tag === tk.tag)) {
        pushText(top(), `[/${tk.tag}]`);
        continue;
      }
      for (;;) {
        const f = stack.pop() as Frame;
        const out = finalize(f, addEmbed);
        const parent = top();
        parent.html.push(out.html);
        parent.raw.push(out.raw);
        if (f.tag === tk.tag) break;
      }
    }
  }
  while (stack.length) {
    const f = stack.pop() as Frame;
    const out = finalize(f, addEmbed);
    const parent = top();
    parent.html.push(out.html);
    parent.raw.push(out.raw);
  }
  return root.html.join("");
}
