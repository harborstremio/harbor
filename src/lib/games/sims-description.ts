/** Catalog previews are plain text; preserve prose without forum decoration. */
export function simsDescriptionPreview(text: string): string {
  const emoji: Record<string, string> = { alarm: "⏰", alarm_clock: "⏰", heart: "♥", smile: "🙂", smiley: "🙂", warning: "⚠" };
  return text
    .replace(/\[url=[^\]]+\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[\/?(?:b|i|u|s|color|size|font|center|left|right|quote|url|list|\*)(?:=[^\]]*)?\]/gi, "")
    .replace(/:([a-z][a-z0-9_]*):/gi, (token, name: string) => emoji[name.toLowerCase()] ?? token)
    .replace(/[-_=~]{3,}/g, " · ")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .replace(/\s+/g, " ").trim();
}

