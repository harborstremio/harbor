import type { EpgProgram } from "@/lib/iptv/types";

export type DurationKind = "current" | "current-next" | "next" | "custom";

export type DurationChoice = {
  kind: DurationKind;
  durationSec: number;
  label: string;
  caption: string;
  programTitle: string | null;
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function buildChoices(
  current: EpgProgram | null,
  next: EpgProgram | null,
  t: Translate,
): DurationChoice[] {
  const now = Date.now();
  const out: DurationChoice[] = [];
  if (current && current.endMs > now) {
    const sec = Math.max(60, Math.round((current.endMs - now) / 1000));
    out.push({
      kind: "current",
      durationSec: sec,
      label: t("This show: {title}", { title: current.title }),
      caption: t("Until {time} · {dur}", {
        time: formatClock(current.endMs),
        dur: formatMinutes(sec),
      }),
      programTitle: current.title,
    });
  }
  if (current && next && next.endMs > now) {
    const sec = Math.max(60, Math.round((next.endMs - now) / 1000));
    out.push({
      kind: "current-next",
      durationSec: sec,
      label: t("This and next: + {title}", { title: next.title }),
      caption: t("Until {time} · {dur}", {
        time: formatClock(next.endMs),
        dur: formatMinutes(sec),
      }),
      programTitle: `${current.title} + ${next.title}`,
    });
  }
  if (next) {
    const start = Math.max(now, next.startMs);
    const sec = Math.max(60, Math.round((next.endMs - start) / 1000));
    if (sec > 60 && start > now + 10_000) {
      out.push({
        kind: "next",
        durationSec: sec + Math.max(0, Math.round((next.startMs - now) / 1000)),
        label: t("Just the next show: {title}", { title: next.title }),
        caption: t("{start} to {end} · {dur}", {
          start: formatClock(next.startMs),
          end: formatClock(next.endMs),
          dur: formatMinutes(sec),
        }),
        programTitle: next.title,
      });
    }
  }
  out.push({
    kind: "custom",
    durationSec: 3600,
    label: t("Custom length"),
    caption: t("Set how many minutes to record"),
    programTitle: null,
  });
  return out;
}

export function suggestFilename(channelName: string, current: EpgProgram | null): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}`;
  const ch = channelName.replace(/[\\/:*?"<>|]/g, "").trim();
  const prog = current?.title?.replace(/[\\/:*?"<>|]/g, "").trim();
  return prog ? `${ch} - ${prog} (${stamp})` : `${ch} (${stamp})`;
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = pad(d.getMinutes());
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${m} ${suffix}`;
}

export function formatMinutes(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function formatRemaining(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function prettifyError(raw: string, t: Translate): string {
  const s = raw.replace(/^Error:\s*/i, "");
  if (s.includes("mpv binary not found")) {
    return t("mpv is required for recording. Install mpv and restart Harbor.");
  }
  return s;
}
