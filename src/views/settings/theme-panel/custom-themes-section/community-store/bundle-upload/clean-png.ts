import { t } from "@/lib/i18n";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_BYTES = 150 * 1024;
const MAX_DIM = 384;
const MIN_DIM = 96;
const PREVIEW_DIM = 512;
const GIF_UPLOAD_MAX = 2 * 1024 * 1024;
const GIF_PREVIEW_MAX = 1024 * 1024;

export type CleanIcon = {
  file: File;
  preview: string;
  width: number;
  height: number;
  optimized: boolean;
  flattened?: boolean;
};
export type CleanPngResult = { ok: true; icon: CleanIcon } | { ok: false; error: string };

function hasPngMagic(head: ArrayBuffer): boolean {
  const bytes = new Uint8Array(head);
  if (bytes.length < 8) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

function isGif(head: ArrayBuffer): boolean {
  const b = new Uint8Array(head);
  return b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function scaledCanvas(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
  }
  return canvas;
}

function previewFrom(img: HTMLImageElement): string {
  return scaledCanvas(img, PREVIEW_DIM).toDataURL("image/webp", 0.85);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function pngName(name: string): string {
  if (/\.png$/i.test(name)) return name;
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  return `${base || "icon"}.png`;
}

function gifName(name: string): string {
  if (/\.gif$/i.test(name)) return name;
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  return `${base || "icon"}.gif`;
}

function asGif(file: File): File {
  if (file.type === "image/gif" && /\.gif$/i.test(file.name)) return file;
  return new File([file], gifName(file.name), { type: "image/gif" });
}

async function optimize(
  img: HTMLImageElement,
  name: string,
): Promise<{ file: File; width: number; height: number } | null> {
  let dim = Math.min(MAX_DIM, Math.max(img.naturalWidth, img.naturalHeight));
  let out: { blob: Blob; w: number; h: number } | null = null;
  for (let i = 0; i < 10; i++) {
    const canvas = scaledCanvas(img, dim);
    const blob = await canvasToPng(canvas);
    if (!blob) break;
    out = { blob, w: canvas.width, h: canvas.height };
    if (blob.size <= MAX_BYTES || dim <= MIN_DIM) break;
    dim = Math.max(MIN_DIM, Math.round(dim * 0.82));
  }
  if (!out) return null;
  return {
    file: new File([out.blob], pngName(name), { type: "image/png" }),
    width: out.w,
    height: out.h,
  };
}

export async function cleanPng(file: File): Promise<CleanPngResult> {
  const head = await file
    .slice(0, 8)
    .arrayBuffer()
    .catch(() => null);
  const gif = !!head && isGif(head);
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    if (gif) {
      const width = img?.naturalWidth ?? 0;
      const height = img?.naturalHeight ?? 0;
      if (file.size <= GIF_UPLOAD_MAX) {
        let preview = "";
        if (file.size <= GIF_PREVIEW_MAX) {
          preview = await fileToDataUrl(file).catch(() => "");
          if (!preview && img) preview = previewFrom(img);
        } else {
          preview = img ? previewFrom(img) : await fileToDataUrl(file).catch(() => "");
        }
        if (preview)
          return {
            ok: true,
            icon: { file: asGif(file), preview, width, height, optimized: false },
          };
      }
      if (img) {
        const opt = await optimize(img, file.name);
        if (opt)
          return {
            ok: true,
            icon: {
              file: opt.file,
              preview: previewFrom(img),
              width: opt.width,
              height: opt.height,
              optimized: true,
              flattened: true,
            },
          };
      }
      return { ok: false, error: t("could not be optimized") };
    }

    if (!img || !img.naturalWidth || !img.naturalHeight)
      return { ok: false, error: t("is not an image we can read") };

    const preview = previewFrom(img);
    const isPng = !!head && hasPngMagic(head);
    const oversizeDim = img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM;
    const oversizeBytes = file.size > MAX_BYTES;
    if (isPng && !oversizeDim && !oversizeBytes) {
      return {
        ok: true,
        icon: {
          file,
          preview,
          width: img.naturalWidth,
          height: img.naturalHeight,
          optimized: false,
        },
      };
    }
    const opt = await optimize(img, file.name);
    if (!opt) return { ok: false, error: t("could not be optimized") };
    return {
      ok: true,
      icon: { file: opt.file, preview, width: opt.width, height: opt.height, optimized: true },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
