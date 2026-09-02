import { t } from "@/lib/i18n";

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return t("just now");
  const m = Math.floor(s / 60);
  if (m < 60) return t("{count}m ago", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("{count}h ago", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("{count}d ago", { count: d });
  const w = Math.floor(d / 7);
  if (w < 5) return t("{count}w ago", { count: w });
  const mo = Math.floor(d / 30);
  if (mo < 12) return t("{count}mo ago", { count: mo });
  return t("{count}y ago", { count: Math.floor(d / 365) });
}
