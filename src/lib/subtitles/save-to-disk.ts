import { unzipSync } from "fflate";
import { downloadText } from "@/lib/download-text";
import { markLimitReached } from "./limit-signal";

const SUB_EXTS = ["srt", "ass", "ssa", "vtt", "sub"];

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

function extractFromZip(bytes: Uint8Array): Uint8Array | null {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return null;
  }
  let best: Uint8Array | null = null;
  for (const [name, data] of Object.entries(entries)) {
    if (!SUB_EXTS.includes(extensionOf(name))) continue;
    if (!best || data.length > best.length) best = data;
  }
  return best;
}

export async function saveSubtitleToDisk(
  url: string,
  opts: { title?: string; lang?: string; format?: string; label: string },
): Promise<"ok" | "failed" | "limited"> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      markLimitReached(url);
      return "limited";
    }
    return "failed";
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  const bytes = (isZip ? extractFromZip(buf) : null) ?? buf;
  const text = new TextDecoder("utf-8").decode(bytes);
  const ext = (opts.format || "srt").toLowerCase().replace(/[^a-z0-9]/g, "") || "srt";
  const base = (opts.title || opts.lang || "subtitle").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  const ok = await downloadText(`${base}.${ext}`, text, [ext], opts.label);
  return ok ? "ok" : "failed";
}
