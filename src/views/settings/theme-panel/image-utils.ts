const MAX_IMAGE_BYTES = 8_000_000;
const MAX_IMAGE_DIMENSION = 3840;

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Read failed"));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

async function downscaleImage(dataURL: string): Promise<string | null> {
  const img = new Image();
  img.src = dataURL;
  await img.decode().catch(() => null);
  if (!img.width || !img.height) return null;
  const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  for (const q of [0.85, 0.7, 0.55, 0.4, 0.25]) {
    const out = canvas.toDataURL("image/jpeg", q);
    if (out.length < MAX_IMAGE_BYTES) return out;
  }
  return null;
}

export async function processBackgroundImage(file: File): Promise<string | null> {
  const raw = await readFileAsDataURL(file).catch(() => null);
  if (!raw) return null;
  if (raw.length < MAX_IMAGE_BYTES) return raw;
  return downscaleImage(raw);
}

const SHARE_BG_MAX_DIMENSION = 2560;
const SHARE_BG_BUDGET = 1_200_000;

export async function optimizeBackgroundForShare(dataURL: string): Promise<string> {
  if (!dataURL.startsWith("data:image/")) return dataURL;
  if (dataURL.startsWith("data:image/svg")) return dataURL;
  if (dataURL.length <= SHARE_BG_BUDGET) return dataURL;
  const img = new Image();
  img.src = dataURL;
  await img.decode().catch(() => null);
  if (!img.width || !img.height) return dataURL;
  const ratio = Math.min(1, SHARE_BG_MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataURL;
  ctx.drawImage(img, 0, 0, w, h);
  let best = dataURL;
  for (const q of [0.86, 0.78, 0.68, 0.58, 0.45, 0.35]) {
    const out = canvas.toDataURL("image/jpeg", q);
    if (out.length < best.length) best = out;
    if (out.length <= SHARE_BG_BUDGET) return out;
  }
  return best;
}

export async function processLogoImage(file: File, maxDim: number): Promise<string | null> {
  const raw = await readFileAsDataURL(file).catch(() => null);
  if (!raw) return null;
  if (raw.startsWith("data:image/svg")) return raw.length < 256_000 ? raw : null;
  const img = new Image();
  img.src = raw;
  await img.decode().catch(() => null);
  if (!img.width || !img.height) return null;
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/png");
  return out.length < 900_000 ? out : null;
}
