import type { IptvChannel } from "./types";

export type CatchupType = "default" | "append" | "shift" | "flussonic" | "xtream";

function attr(ch: IptvChannel, key: string): string | null {
  const v = ch.attrs[key];
  return v != null && v !== "" ? v : null;
}

const XTREAM_LIVE_RX = /^(https?:\/\/[^/]+)\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)\.(\w+)(?:\?|$)/i;

export function detectCatchupType(ch: IptvChannel): CatchupType | null {
  const raw = (attr(ch, "catchup") ?? attr(ch, "catchup-type") ?? "").toLowerCase().trim();
  if (raw === "flussonic" || raw === "fs") return "flussonic";
  if (raw === "xc" || raw === "xtream") return "xtream";
  if (raw === "append") return "append";
  if (raw === "shift" || raw === "timeshift") return "shift";
  if (raw === "default" || ch.catchupSource) return "default";
  if (XTREAM_LIVE_RX.test(ch.url)) return "xtream";
  return null;
}

export function channelHasCatchup(ch: IptvChannel): boolean {
  return detectCatchupType(ch) != null;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function strftime(fmt: string, d: Date): string {
  return fmt
    .replace(/Y/g, String(d.getUTCFullYear()))
    .replace(/m/g, pad(d.getUTCMonth() + 1))
    .replace(/d/g, pad(d.getUTCDate()))
    .replace(/H/g, pad(d.getUTCHours()))
    .replace(/M/g, pad(d.getUTCMinutes()))
    .replace(/S/g, pad(d.getUTCSeconds()));
}

function fillTemplate(
  tpl: string,
  start: number,
  end: number,
  now: number,
  duration: number,
): string {
  const offset = Math.max(0, now - start);
  const startDate = new Date(start * 1000);
  let out = tpl;
  out = out.replace(/\$\{(start|utc):([^}]+)\}/gi, (_, _k, f) => strftime(f, startDate));
  out = out.replace(/\{(?:utc|start):([^}]+)\}/gi, (_, f) => strftime(f, startDate));
  const map: Record<string, string> = {
    start: String(start),
    utc: String(start),
    timestamp: String(start),
    end: String(end),
    utcend: String(end),
    now: String(now),
    lutc: String(now),
    timenow: String(now),
    duration: String(duration),
    dur: String(duration),
    offset: String(offset),
    "duration-minutes": String(Math.ceil(duration / 60)),
  };
  out = out.replace(/\$\{(\w[\w-]*)\}/gi, (m, k) => map[k.toLowerCase()] ?? m);
  out = out.replace(/\{(\w[\w-]*)\}/gi, (m, k) => map[k.toLowerCase()] ?? m);
  return out;
}

function flussonicUrl(base: string, start: number, duration: number): string | null {
  const q = base.indexOf("?");
  const path = q >= 0 ? base.slice(0, q) : base;
  const query = q >= 0 ? base.slice(q) : "";
  const m = path.match(/^(.*)\/([^/]+)\.(m3u8|ts|mpd)$/i);
  if (m) {
    const [, dir, file, ext] = m;
    const stem = file === "mpegts" || file === "mono" ? "index" : file;
    return `${dir}/${stem}-${start}-${duration}.${ext}${query}`;
  }
  const trimmed = path.replace(/\/+$/, "");
  return `${trimmed}/archive-${start}-${duration}.ts${query}`;
}

export function buildCatchupUrl(
  ch: IptvChannel,
  startMs: number,
  endMs: number,
  nowMs: number = Date.now(),
): string | null {
  const type = detectCatchupType(ch);
  if (!type) return null;
  const start = Math.floor(startMs / 1000);
  const end = Math.floor(endMs / 1000);
  const now = Math.floor(nowMs / 1000);
  const duration = Math.max(60, end - start);

  if (type === "flussonic") {
    return flussonicUrl(ch.url, start, duration);
  }

  if (type === "xtream") {
    const m = ch.url.match(XTREAM_LIVE_RX);
    if (!m) return null;
    const [, host, user, pass, id] = m;
    const mins = Math.ceil(duration / 60);
    const stamp = strftime("Y-m-d:H-M", new Date(start * 1000));
    return `${host}/timeshift/${user}/${pass}/${mins}/${stamp}/${id}.ts`;
  }

  if (ch.catchupSource) {
    const src = ch.catchupSource;
    if (/^https?:\/\//i.test(src)) {
      return fillTemplate(src, start, end, now, duration);
    }
    const sep = ch.url.includes("?") ? "&" : "?";
    return (
      ch.url +
      (src.startsWith("?") || src.startsWith("&") ? "" : sep) +
      fillTemplate(src.replace(/^[?&]/, ""), start, end, now, duration)
    );
  }

  const sep = ch.url.includes("?") ? "&" : "?";
  return `${ch.url}${sep}utc=${start}&lutc=${now}`;
}
