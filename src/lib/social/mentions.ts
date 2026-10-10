const MENTION_RE = /(^|[^A-Za-z0-9_@\/])@([A-Za-z0-9][A-Za-z0-9-]{1,22}[A-Za-z0-9])/g;

export const MAX_MENTIONS = 5;

export type MentionSegment = { text: string; handle: string | null };

type Hit = { at: number; text: string; handle: string };

function scan(text: string): Hit[] {
  const hits: Hit[] = [];
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(text); m; m = MENTION_RE.exec(text)) {
    hits.push({ at: m.index + m[1].length, text: `@${m[2]}`, handle: m[2].toLowerCase() });
  }
  return hits;
}

export function scanMentions(text: string): { notified: string[]; ignored: string[] } {
  const notified: string[] = [];
  const ignored: string[] = [];
  for (const hit of scan(text)) {
    if (notified.includes(hit.handle) || ignored.includes(hit.handle)) continue;
    (notified.length < MAX_MENTIONS ? notified : ignored).push(hit.handle);
  }
  return { notified, ignored };
}

export function segmentMentions(text: string, allowed?: ReadonlySet<string>): MentionSegment[] {
  const live = allowed ?? new Set(scanMentions(text).notified);
  const out: MentionSegment[] = [];
  let last = 0;
  const plain = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && prev.handle === null) prev.text += s;
    else out.push({ text: s, handle: null });
  };
  for (const hit of scan(text)) {
    if (!live.has(hit.handle)) continue;
    plain(text.slice(last, hit.at));
    out.push({ text: hit.text, handle: hit.handle });
    last = hit.at + hit.text.length;
  }
  plain(text.slice(last));
  return out.length ? out : [{ text, handle: null }];
}

const TOKEN_RE = /(?:^|[^A-Za-z0-9_@/])@([A-Za-z0-9-]{0,24})$/;

export function mentionToken(text: string, caret: number): { start: number; query: string } | null {
  const m = TOKEN_RE.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1] };
}
