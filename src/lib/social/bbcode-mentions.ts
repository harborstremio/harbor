import { segmentMentions } from "./mentions";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MENTION_STYLE = "color:var(--color-accent);font-weight:600;cursor:pointer";

export function escapeWithMentions(s: string, allowed?: ReadonlySet<string>): string {
  if (!allowed?.size) return escapeHtml(s);
  return segmentMentions(s, allowed)
    .map((seg) =>
      seg.handle
        ? `<span data-harbor-mention="${escapeHtml(seg.handle)}" role="button" tabindex="0" style="${MENTION_STYLE}">${escapeHtml(seg.text)}</span>`
        : escapeHtml(seg.text),
    )
    .join("");
}
