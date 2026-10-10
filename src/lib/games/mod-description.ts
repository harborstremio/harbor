export type ModDescriptionBlock = { kind: "heading" | "paragraph" | "list" | "ordered-list"; lines: string[]; start?: number };

/** Recover explicit text structure from provider plain text, never execute its HTML. */
export function modDescriptionBlocks(text: string): ModDescriptionBlock[] {
  const blocks: ModDescriptionBlock[] = [];
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const ordered = /^(\d+)[.)]\s+/.exec(trimmed);
    const bullet = !!ordered || /^[•●*\-]\s+/.test(trimmed);
    const heading = trimmed.length <= 90 && (/^(?:#{1,4}\s|change\s*log\b|update\s*\d|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}.*(?:log|update))/i.test(trimmed) || /^(?:Installation|Requirements|Compatibility|Known issues|Features|How to use|Credits|Translations|Troubleshooting):?$/i.test(trimmed));
    const kind = ordered ? "ordered-list" : bullet ? "list" : heading ? "heading" : "paragraph";
    const value = bullet ? trimmed.replace(/^(?:[•●*\-]|\d+[.)])\s+/, "") : trimmed.replace(/^#{1,4}\s+/, "");
    const previous = blocks.at(-1);
    if (kind === "list" && previous?.kind === "list" || kind === "ordered-list" && previous?.kind === "ordered-list" && Number(ordered![1]) === previous.start! + previous.lines.length) previous.lines.push(value);
    else blocks.push({ kind, lines: [value], ...(ordered ? { start: Number(ordered[1]) } : {}) });
  }
  return blocks;
}
