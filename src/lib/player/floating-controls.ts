export type FloatingTrack = { id: number; type: "audio" | "sub"; title?: string; lang?: string; selected: boolean };
export type FloatingChapter = { title: string; time: number };
export function floatingTracks(value: unknown): FloatingTrack[] {
  if (!Array.isArray(value)) return [];
  return value.filter(v => v && typeof v === "object" && Number.isInteger(v.id) && (v.type === "audio" || v.type === "sub"))
    .slice(0, 150).map(v => ({ id: v.id, type: v.type, title: typeof v.title === "string" ? v.title : undefined, lang: typeof v.lang === "string" ? v.lang : undefined, selected: v.selected === true }));
}
export function floatingChapters(value: unknown): FloatingChapter[] {
  if (!Array.isArray(value)) return [];
  return value.filter(v => v && typeof v.time === "number" && Number.isFinite(v.time) && v.time >= 0)
    .slice(0, 500).map(v => ({ title: typeof v.title === "string" ? v.title : "", time: v.time }));
}
export function floatingSeek(value: number, duration: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(duration > 0 ? duration : Infinity, value)) : 0;
}
