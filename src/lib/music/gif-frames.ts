import { parseGIF, decompressFrame } from "gifuct-js";

export type MusicGifFrames = { width: number; height: number; delays: number[]; frames: Uint8ClampedArray[]; duration: number };
export const MAX_GIF_BYTES = 25 * 1024 * 1024;

/** Compose disposal-aware frames in a worker. Keep the saved original untouched. */
export function decodeMusicGif(bytes: ArrayBuffer): MusicGifFrames {
  if (bytes.byteLength > MAX_GIF_BYTES) throw new Error("large");
  const signature = new TextDecoder().decode(bytes.slice(0, 6));
  if (signature !== "GIF87a" && signature !== "GIF89a") throw new Error("invalid");
  const gif = parseGIF(bytes), { width, height } = gif.lsd;
  const images = gif.frames.filter(frame => "image" in frame);
  if (!images.length || width < 1 || height < 1) throw new Error("invalid");
  if (width * height > 16_777_216 || images.length > 1200) throw new Error("large");
  const scale = Math.min(1, 288 / Math.max(width, height), Math.sqrt(48 * 1024 * 1024 / (width * height * 4 * images.length)));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const canvas = new Uint8ClampedArray(width * height * 4);
  const background = gif.gct?.[gif.lsd.backgroundColorIndex];
  const clear = (left: number, top: number, w: number, h: number, transparent: boolean) => {
    const color = !transparent && background ? [...background, 255] : [0, 0, 0, 0];
    for (let y = top; y < top + h; y++) for (let x = left; x < left + w; x++) {
      canvas.set(color, (y * width + x) * 4);
    }
  };
  clear(0, 0, width, height, !!images[0].gce?.extras.transparentColorGiven);
  const frames: Uint8ClampedArray[] = [], delays: number[] = [];
  let previous: ReturnType<typeof decompressFrame> | null = null, saved: Uint8ClampedArray | null = null;
  for (const raw of images) {
    const rect = raw.image.descriptor;
    if (!rect.width || !rect.height || rect.width * rect.height > 16_777_216 ||
        rect.left + rect.width > width || rect.top + rect.height > height) throw new Error("invalid");
    if (previous?.disposalType === 2) {
      const d = previous.dims;
      // Transparent stickers clear to transparency; opaque GIFs restore their
      // declared screen background instead of leaving holes between patches.
      clear(d.left, d.top, d.width, d.height, previous.transparentIndex !== undefined);
    } else if (previous?.disposalType === 3 && saved) canvas.set(saved);
    const frame = decompressFrame(raw, gif.gct, true);
    saved = frame.disposalType === 3 ? canvas.slice() : null;
    for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) {
      const from = (y * rect.width + x) * 4;
      if (frame.patch[from + 3] === 0) continue;
      const to = ((y + rect.top) * width + x + rect.left) * 4;
      canvas.set(frame.patch.subarray(from, from + 4), to);
    }
    const pixels = new Uint8ClampedArray(w * h * 4);
    // Area samples avoid aliased outlines when a large GIF becomes a small perch.
    const taps = scale < .6 ? 4 : 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let alpha = 0; const rgb = [0, 0, 0];
      for (let n = 0; n < taps; n++) {
        const sx = Math.min(width - 1, Math.floor((x + (taps === 1 ? .5 : .25 + (n % 2) * .5)) * width / w));
        const sy = Math.min(height - 1, Math.floor((y + (taps === 1 ? .5 : .25 + Math.floor(n / 2) * .5)) * height / h));
        const i = (sy * width + sx) * 4, a = canvas[i + 3]; alpha += a;
        for (let c = 0; c < 3; c++) rgb[c] += canvas[i + c] * a;
      }
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = alpha ? rgb[c] / alpha : 0;
      pixels[i + 3] = alpha / taps;
    }
    frames.push(pixels); delays.push(Math.max(20, frame.delay || 100)); previous = frame;
  }
  return { width: w, height: h, frames, delays, duration: delays.reduce((a, b) => a + b, 0) };
}

export function musicGifFrameAt(animation: Pick<MusicGifFrames, "duration" | "delays">, position: number) {
  let time = ((position % 1 + 1) % 1) * animation.duration;
  for (let i = 0; i < animation.delays.length; i++) {
    if (time < animation.delays[i]) return i;
    time -= animation.delays[i];
  }
  return 0;
}
