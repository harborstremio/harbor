import { safeFetch as fetch } from "@/lib/safe-fetch";
import { decodeSubtitleBytes } from "./encoding";

export type SubCue = {
  start: number;
  end: number;
  text: string;
};

export type SubFormat = "srt" | "vtt" | "ass" | "ssa" | "sub";

export type SubtitleDecodeOptions = {
  encoding?: string;
  lang?: string;
  format?: SubFormat;
};

export async function fetchAndParse(
  url: string,
  options: SubtitleDecodeOptions = {},
): Promise<SubCue[]> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`subtitle fetch ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = decodeSubtitleBytes(new Uint8Array(buf), options);
  return parseSubtitle(text, options.format);
}

export function parseSubtitle(raw: string, format?: SubFormat): SubCue[] {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const fmt = format ?? detectFormat(text);
  if (fmt === "vtt") return parseVtt(text);
  if (fmt === "ass" || fmt === "ssa") return parseAss(text);
  return parseSrt(text);
}

function detectFormat(text: string): SubFormat {
  const head = text.slice(0, 200).trim();
  if (/^WEBVTT/i.test(head)) return "vtt";
  if (/\[Script Info\]/i.test(head) || /^\[V4\+? Styles\]/im.test(text)) return "ass";
  return "srt";
}

function parseSrt(text: string): SubCue[] {
  const cues: SubCue[] = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    let timingIdx = 0;
    if (/^\d+$/.test(lines[0].trim())) timingIdx = 1;
    const timing = lines[timingIdx];
    const m = timing?.match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/,
    );
    if (!m) continue;
    const start = toSec(m[1], m[2], m[3], m[4]);
    const end = toSec(m[5], m[6], m[7], m[8]);
    const body = lines.slice(timingIdx + 1).join("\n");
    if (body.length === 0) continue;
    cues.push({ start, end, text: cleanInline(body) });
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseVtt(text: string): SubCue[] {
  const cues: SubCue[] = [];
  const stripped = text.replace(/^WEBVTT[^\n]*\n+/i, "");
  const blocks = stripped.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length < 1) continue;
    let timingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timingIdx = i;
        break;
      }
    }
    if (timingIdx === -1) continue;
    const m = lines[timingIdx].match(
      /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/,
    );
    if (!m) continue;
    const start = toSec(m[1] ?? "0", m[2], m[3], m[4]);
    const end = toSec(m[5] ?? "0", m[6], m[7], m[8]);
    const body = lines.slice(timingIdx + 1).join("\n");
    if (body.length === 0) continue;
    cues.push({ start, end, text: cleanInline(body) });
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseAss(text: string): SubCue[] {
  const cues: SubCue[] = [];
  const eventsIdx = text.search(/\[Events\]/i);
  if (eventsIdx === -1) return cues;
  const eventsBlock = text.slice(eventsIdx);
  const lines = eventsBlock.split("\n");
  let format: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith("Format:")) {
      format = line
        .slice(7)
        .split(",")
        .map((s) => s.trim().toLowerCase());
      continue;
    }
    if (!line.startsWith("Dialogue:")) continue;
    if (!format) continue;
    const startIdx = format.indexOf("start");
    const endIdx = format.indexOf("end");
    const textIdx = format.indexOf("text");
    if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;
    const parts = splitAssDialogue(line.slice(9), format.length);
    if (parts.length < format.length) continue;
    const start = parseAssTime(parts[startIdx]);
    const end = parseAssTime(parts[endIdx]);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const body = stripAssTags(parts[textIdx]);
    if (body.length === 0) continue;
    cues.push({ start, end, text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}

function splitAssDialogue(line: string, fields: number): string[] {
  const out: string[] = [];
  let i = 0;
  let buf = "";
  let count = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === "," && count < fields - 1) {
      out.push(buf.trim());
      buf = "";
      count++;
    } else {
      buf += c;
    }
    i++;
  }
  out.push(buf);
  return out;
}

function parseAssTime(s: string): number {
  const m = s.match(/(\d+):(\d{2}):(\d{2})\.(\d{1,3})/);
  if (!m) return NaN;
  return toSec(m[1], m[2], m[3], (m[4] + "00").slice(0, 3));
}

function stripAssTags(s: string): string {
  return s
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, " ")
    .replace(/\\h/g, " ")
    .trim();
}

function cleanInline(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toSec(h: string, m: string, s: string, ms: string): number {
  const padded = (ms + "000").slice(0, 3);
  return (
    parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(padded, 10) / 1000
  );
}

export function findActiveCue(cues: SubCue[], timeSec: number): SubCue | null {
  if (cues.length === 0) return null;
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid];
    if (timeSec < c.start) hi = mid - 1;
    else if (timeSec >= c.end) lo = mid + 1;
    else return c;
  }
  return null;
}
