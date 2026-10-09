import { normalizeSkin } from "./minecraft-skin";

export function skinPng(pixels: Uint8ClampedArray): string {
  const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
  const context = canvas.getContext("2d"); if (!context) throw new Error("skin_canvas");
  const image = context.createImageData(64, 64); image.data.set(pixels); context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function readSkinPng(source: File | string): Promise<Uint8ClampedArray> {
  if (typeof source !== "string") {
    if (source.size > 1_048_576 || !/\.png$/i.test(source.name)) throw new Error("skin_size");
    const bytes = new Uint8Array(await source.slice(0, 24).arrayBuffer());
    if (bytes.length !== 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) throw new Error("skin_png");
    const view = new DataView(bytes.buffer), width = view.getUint32(16), height = view.getUint32(20);
    // Bound dimensions before browser decode, including deliberately oversized PNG files.
    if (width !== 64 || (height !== 32 && height !== 64)) throw new Error("skin_size");
  } else if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(source) || source.length > 100_000) throw new Error("skin_png");
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.width !== 64 || (image.height !== 32 && image.height !== 64)) throw new Error("skin_size");
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("skin_canvas");
    context.drawImage(image, 0, 0);
    return normalizeSkin(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  } finally { if (typeof source !== "string") URL.revokeObjectURL(url); }
}

export function downloadSkin(texture: string, name: string) {
  const link = document.createElement("a"); link.href = texture;
  link.download = `${name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 70) || "minecraft-skin"}.png`;
  document.body.append(link); link.click(); link.remove();
}
