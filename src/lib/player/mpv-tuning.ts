import type { Settings } from "@/lib/settings";

const QUALITY_LINES: Record<Settings["mpvQuality"], string[]> = {
  balanced: [],
  performance: [
    "scale=bilinear",
    "cscale=bilinear",
    "dscale=bilinear",
    "dither=no",
    "deband=no",
    "vd-lavc-fast=yes",
    "interpolation=no",
    "hdr-compute-peak=no",
  ],
  quality: [
    "scale=ewa_lanczossharp",
    "cscale=ewa_lanczossharp",
    "dscale=mitchell",
    "deband=yes",
    "deband-iterations=2",
    "dither-depth=auto",
    "correct-downscaling=yes",
    "linear-downscaling=yes",
    "sigmoid-upscaling=yes",
    "hdr-compute-peak=yes",
  ],
};

export function compileMpvOptions(s: Settings): string {
  const lines: string[] = [...(QUALITY_LINES[s.mpvQuality] ?? [])];
  if (s.mpvHwdec === "on") lines.push("hwdec=yes");
  else if (s.mpvHwdec === "off") lines.push("hwdec=no");
  if (s.mpvBufferBoost) {
    lines.push(
      "cache=yes",
      "cache-secs=600",
      "demuxer-max-bytes=1GiB",
      "demuxer-readahead-secs=600",
      "cache-pause-initial=yes",
      "cache-pause-wait=10",
    );
  }
  if (s.mpvDownmixStereo) lines.push("audio-channels=stereo");
  if (s.audioDevice && s.audioDevice !== "auto") lines.push(`audio-device=${s.audioDevice}`);
  if (s.playerDisplayPanel === "oled" && s.playerHdrToSdr) lines.push("target-contrast=inf");
  for (const [k, v] of Object.entries(s.mpvTweaks ?? {})) {
    if (v !== "" && v != null) lines.push(`${k}=${v}`);
  }
  return lines.join("\n");
}

export function svpMpvLines(s: Settings, svpActive: boolean): string {
  if (!svpActive || !s.svpVpyPath) return "";
  const vpy = s.svpVpyPath.replace(/\\/g, "/");
  return [`vf=vapoursynth=[${vpy}]`, "hwdec=auto-copy", "hr-seek-framedrop=no"].join("\n");
}

export function mergeMpvOptions(s: Settings, svpActive: boolean): string | undefined {
  const merged = [compileMpvOptions(s), svpMpvLines(s, svpActive), s.mpvExtraOptions || ""]
    .filter((p) => p.trim())
    .join("\n");
  return merged.trim() ? merged : undefined;
}

const RISKY =
  /^(scripts?|load-script|input-ipc-server|input-conf|input-cmdlist|ytdl-raw-options)$/i;

export type MpvLineCheck = { valid: number; skipped: number; risky: string[] };

export function validateMpvOptions(raw: string): MpvLineCheck {
  let valid = 0;
  let skipped = 0;
  const risky: string[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const body = t.replace(/^--/, "");
    const key = body.split("=")[0].trim();
    if (/^[a-z0-9-]+(=.*)?$/i.test(body) && key) {
      valid++;
      if (RISKY.test(key)) risky.push(key);
    } else {
      skipped++;
    }
  }
  return { valid, skipped, risky };
}
