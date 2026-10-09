export type SubtitleOffsetPosition =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export type SubtitleOffsetSize = "small" | "medium" | "large";

export function formatSubtitleOffset(delaySec: number): string {
  const milliseconds = Math.round(delaySec * 1000);
  return `${milliseconds > 0 ? "+" : ""}${milliseconds} ms`;
}

export function sanitizeSubtitleOffsetPosition(value: unknown): SubtitleOffsetPosition {
  switch (value) {
    case "top-left":
    case "top":
    case "top-right":
    case "left":
    case "center":
    case "right":
    case "bottom-left":
    case "bottom":
    case "bottom-right":
      return value;
    default:
      return "bottom";
  }
}

export function sanitizeSubtitleOffsetSize(value: unknown): SubtitleOffsetSize {
  return value === "small" || value === "large" ? value : "medium";
}
