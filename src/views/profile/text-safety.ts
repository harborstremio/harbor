const URL_RE = /\b((https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|net|org|io|gg|xyz|link|ru|tv)\b[^\s]*)/gi;

const MASK_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "bastard",
  "dick",
  "slut",
  "whore",
  "retard",
];

const MASK_RE = new RegExp(`\\b(${MASK_WORDS.join("|")})\\b`, "gi");

export function containsUrl(text: string): boolean {
  URL_RE.lastIndex = 0;
  return URL_RE.test(text);
}

export function stripUrls(text: string): string {
  return text.replace(URL_RE, "link removed").replace(/\s{2,}/g, " ").trim();
}

export type TextSegment = { text: string; masked: boolean };

export function segmentProfanity(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  MASK_RE.lastIndex = 0;
  for (let m = MASK_RE.exec(text); m; m = MASK_RE.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), masked: false });
    out.push({ text: m[0], masked: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), masked: false });
  return out.length ? out : [{ text, masked: false }];
}

export function looksLikeSpam(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  if (/(.)\1{6,}/.test(trimmed)) return true;
  const letters = trimmed.replace(/[^a-z]/gi, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) return true;
  const symbols = trimmed.replace(/[a-z0-9\s]/gi, "").length;
  if (symbols > trimmed.length * 0.5) return true;
  return false;
}

export const COMMENT_MAX = 280;
export const COMMENT_COOLDOWN_MS = 15000;

export type ComposeIssue = "empty" | "url" | "spam" | "too-long" | "cooldown" | null;

export function validateComment(text: string, lastSentAt: number, now: number): ComposeIssue {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (trimmed.length > COMMENT_MAX) return "too-long";
  if (containsUrl(trimmed)) return "url";
  if (looksLikeSpam(trimmed)) return "spam";
  if (now - lastSentAt < COMMENT_COOLDOWN_MS) return "cooldown";
  return null;
}

export const MENTION_RE = /@([a-zA-Z0-9_.-]{2,32})/g;

export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(text); m; m = MENTION_RE.exec(text)) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

export type MentionSegment = { text: string; handle?: string };

export function segmentMentions(text: string): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(text); m; m = MENTION_RE.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], handle: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

export function activeMentionQuery(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const upto = value.slice(0, caret);
  const m = /(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/.exec(upto);
  if (!m) return null;
  return { query: m[1], start: caret - m[1].length - 1 };
}