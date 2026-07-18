import { GIFEncoder, quantize, applyPalette } from "gifenc";

interface DecodedFrame {
  image: { displayWidth: number; displayHeight: number; duration: number | null; close(): void };
}
interface Decoder {
  tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
  decode(o: { frameIndex: number }): Promise<DecodedFrame>;
  close?(): void;
}
type DecoderCtor = new (o: { data: ArrayBuffer; type: string }) => Decoder;

async function encodeGif(file: File, maxDim: number, maxFrames: number): Promise<string> {
  const Ctor = (globalThis as unknown as { ImageDecoder?: DecoderCtor }).ImageDecoder;
  if (!Ctor) throw new Error("no-image-decoder");
  const data = await file.arrayBuffer();
  const dec = new Ctor({ data, type: "image/gif" });
  await dec.tracks.ready;
  const frameCount = Math.max(1, dec.tracks.selectedTrack?.frameCount ?? 1);

  const first = await dec.decode({ frameIndex: 0 });
  const ow = first.image.displayWidth;
  const oh = first.image.displayHeight;
  first.image.close();
  const scale = Math.min(maxDim / ow, maxDim / oh, 1);
  const w = Math.max(1, Math.round(ow * scale));
  const h = Math.max(1, Math.round(oh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no-ctx");

  const enc = GIFEncoder();
  const step = frameCount > maxFrames ? Math.ceil(frameCount / maxFrames) : 1;
  for (let i = 0; i < frameCount; i += step) {
    let frame: DecodedFrame;
    try {
      frame = await dec.decode({ frameIndex: i });
    } catch {
      break;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(frame.image as unknown as CanvasImageSource, 0, 0, w, h);
    const durUs = frame.image.duration ?? 100_000;
    frame.image.close();
    const { data: rgba } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    enc.writeFrame(index, w, h, {
      palette,
      delay: Math.max(20, Math.round((durUs / 1000) * step)),
    });
  }
  enc.finish();
  dec.close?.();

  const bytes = enc.bytes();
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:image/gif;base64,${btoa(bin)}`;
}

export async function shrinkGif(file: File): Promise<string> {
  const full = await encodeGif(file, 224, 64);
  if (full.length <= 560_000) return full;
  return encodeGif(file, 152, 32);
}
