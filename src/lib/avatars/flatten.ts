export const DEFAULT_PERSON_BG = "#e4e7ec";
const PERSON_BG_KEY = "harbor.avatarPersonBg";

export function loadPersonBg(): string {
  try {
    return localStorage.getItem(PERSON_BG_KEY) || DEFAULT_PERSON_BG;
  } catch {
    return DEFAULT_PERSON_BG;
  }
}

export function savePersonBg(color: string): void {
  try {
    localStorage.setItem(PERSON_BG_KEY, color);
  } catch {
    /* ignore */
  }
}

export function flattenAvatar(src: string, bg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 384;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas 2d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/webp", 0.9));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
