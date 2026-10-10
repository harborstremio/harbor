import type { UiLanguage } from "./languages";

export const PRODUCT_NAME = "JL Media Vision";

// Catalogs still carry the upstream product name in hundreds of strings across
// every language. Rewriting it here, after a string is resolved and before
// variables are filled in, brands all of them in one place without touching the
// catalogs, and keeps user data passed in as variables untouched.
//
// Case-sensitive and word-bounded, so lower-case hosts and identifiers
// ("harbor.site", "harbor-overlay") never match. The lookarounds also skip
// dotted names ("Harbor.exe") and longer identifiers ("zeroHarbor",
// "HarborDVR"); a match inside a URL is skipped by the replacer. Folder paths
// such as "Pictures/Harbor" are rewritten on purpose: captures now save under
// the product name. ASCII \w keeps a following CJK or Hangul particle
// ("Harbor에서") a match.
const BRAND_RE = /(?<![\w.@:\\-])Harbor(s?)(?![\w@]|\.\w)/g;
const URL_TOKEN = /(?:^|\s)\S*$/;

function insideUrl(text: string, offset: number): boolean {
  const token = URL_TOKEN.exec(text.slice(0, offset))?.[0] ?? "";
  return token.includes("://") || /(?:^|\s)www\./.test(token);
}

export function applyBrand(text: string, lang: UiLanguage): string {
  if (!text.includes("Harbor")) return text;
  return text.replace(BRAND_RE, (match: string, plural: string, offset: number) => {
    if (insideUrl(text, offset)) return match;
    if (!plural) return PRODUCT_NAME;
    // German uses the -s genitive ("Harbors eigene Leiste"); elsewhere the
    // trailing s is a plural of the app, which reads as the bare name.
    return lang === "de" ? `${PRODUCT_NAME}s` : PRODUCT_NAME;
  });
}
