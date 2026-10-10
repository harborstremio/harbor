import { URL_RE, safeImageUrl, safeLinkUrl } from "./safe-url";
import { t } from "@/lib/i18n";

export const MAX_COMMENT_LEN = 2000;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

function deleet(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) out += LEET[ch] ?? ch;
  return out;
}

const SLUR_WORDS = [
  "nigger",
  "nigga",
  "niglet",
  "sandnigger",
  "chink",
  "chinaman",
  "gook",
  "kike",
  "spic",
  "beaner",
  "wetback",
  "faggot",
  "tranny",
  "shemale",
  "coon",
  "paki",
  "raghead",
  "towelhead",
  "zipperhead",
  "gyppo",
];

function evasion(word: string): string {
  return word
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\W_]*")
    .join("");
}

const SLUR_RE = SLUR_WORDS.map((w) => new RegExp(`(^|[^a-z0-9])(${evasion(w)})(?![a-z0-9])`, "i"));

export function hasSlur(raw: string): boolean {
  const norm = deleet(raw);
  return SLUR_RE.some((re) => re.test(norm));
}

const ZERO_WIDTH = new RegExp(
  "[" +
    [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0xfeff]
      .map(function (c) {
        return String.fromCharCode(c);
      })
      .join("") +
    "]",
  "g",
);

export function stripUnsafeUrls(text: string): string {
  let out = text.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (m, url) =>
    safeImageUrl(String(url).trim()) ? m : "",
  );
  out = out.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (m, href, label) =>
    safeLinkUrl(String(href).trim()) ? m : String(label),
  );
  out = out.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (m, href) =>
    safeLinkUrl(String(href).trim()) ? m : "",
  );
  out = out.replace(URL_RE, (u) => (safeLinkUrl(u) ? u : ""));
  return out;
}

export type CleanResult = { ok: true; text: string } | { ok: false; reason: string };

export function cleanCommentText(raw: string): CleanResult {
  const normalized = raw.replace(/\r\n/g, "\n").replace(ZERO_WIDTH, "").trim();
  if (!normalized) return { ok: false, reason: t("Write something first.") };
  const capped = normalized.slice(0, MAX_COMMENT_LEN);
  if (hasSlur(capped)) return { ok: false, reason: t("This comment can't be posted.") };
  const scrubbed = stripUnsafeUrls(capped);
  if (!scrubbed.trim())
    return { ok: false, reason: t("Nothing left to post after removing links.") };
  return { ok: true, text: scrubbed };
}
