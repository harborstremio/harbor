import type { SubCue } from "./parser";

export function toSrt(cues: SubCue[]): string {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const blocks = sorted.map(
    (cue, i) => `${i + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`,
  );
  return blocks.join("\n\n") + "\n";
}

export function toVtt(cues: SubCue[]): string {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const blocks = sorted.map((cue) => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`);
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}

function formatSrtTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(millis, 3)}`;
}

function formatVttTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  if (h > 0) {
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(millis, 3)}`;
  }
  return `${pad(m, 2)}:${pad(s, 2)}.${pad(millis, 3)}`;
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}
