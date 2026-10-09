export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const VOL_MAX = 6;
export const NORMAL_FRACTION = 0.64;
export const TRACK_WIDTH = 128;

export function fractionFromValue(v: number, max: number = VOL_MAX): number {
  const clamped = Math.max(0, Math.min(max, v));
  if (clamped <= 1 || max <= 1) return clamped * NORMAL_FRACTION;
  return NORMAL_FRACTION + ((clamped - 1) / (max - 1)) * (1 - NORMAL_FRACTION);
}

export function valueFromFraction(f: number, max: number = VOL_MAX): number {
  const clamped = Math.max(0, Math.min(1, f));
  if (clamped <= NORMAL_FRACTION) return (clamped / NORMAL_FRACTION) * 1;
  return 1 + ((clamped - NORMAL_FRACTION) / (1 - NORMAL_FRACTION)) * (max - 1);
}

export function boostColor(value: number, max: number = VOL_MAX): string {
  if (value <= 1) return "#ffffff";
  const t = max > 1 ? Math.min(1, (value - 1) / (max - 1)) : 0;
  const r = Math.round(249 - t * (249 - 220));
  const g = Math.round(115 - t * (115 - 38));
  const b = Math.round(22 - t * (22 - 38));
  return `rgb(${r}, ${g}, ${b})`;
}
