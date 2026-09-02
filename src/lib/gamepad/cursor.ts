export type ControllerCursorId = "dot" | "ring" | "arrow" | "harbor" | "custom";

export const CONTROLLER_CURSOR_PRESETS: ReadonlyArray<ControllerCursorId> = [
  "dot",
  "ring",
  "arrow",
  "harbor",
];

export const CONTROLLER_CURSOR_SIZE_MIN = 16;
export const CONTROLLER_CURSOR_SIZE_MAX = 72;
export const DEFAULT_CONTROLLER_CURSOR_SIZE = 30;

const IMAGE_MAX_CHARS = 200_000;

export function sanitizeControllerCursor(value: unknown): ControllerCursorId {
  if (value === "custom") return "custom";
  return CONTROLLER_CURSOR_PRESETS.includes(value as ControllerCursorId)
    ? (value as ControllerCursorId)
    : "dot";
}

export function sanitizeControllerCursorSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONTROLLER_CURSOR_SIZE;
  return Math.min(
    CONTROLLER_CURSOR_SIZE_MAX,
    Math.max(CONTROLLER_CURSOR_SIZE_MIN, Math.round(value)),
  );
}

export function sanitizeControllerCursorImage(value: unknown): string {
  if (typeof value !== "string") return "";
  if (!value.startsWith("data:image/")) return "";
  return value.length > IMAGE_MAX_CHARS ? "" : value;
}

export async function cursorImageFromFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.size > 4 * 1024 * 1024) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const scale = Math.min(1, 128 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/webp", 0.85);
    return out.length > IMAGE_MAX_CHARS ? null : out;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
