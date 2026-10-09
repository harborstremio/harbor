import "./mod-stats.css";
import { Download, Eye, Heart, MessageCircle, ThumbsUp, Layers, Box, Palette, Sparkles } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";

export type ModMetrics = { downloads?: number | null; comments?: number | null; favorites?: number | null; thanks?: number | null; views?: number | null; followers?: number | null; rounded?: Partial<Record<"downloads" | "comments" | "favorites" | "thanks" | "views" | "followers", string>> };
export function ModStats({ values, compact = false }: { values?: ModMetrics | null; compact?: boolean }) {
  const t = useT(), language = useUiLanguage();
  const entries = [
    ["downloads", Download, "games.minecraft.catalog.downloads"], ["favorites", Heart, "games.modHub.favorites"],
    ["comments", MessageCircle, "games.modHub.comments"], ["thanks", ThumbsUp, "games.modHub.thanks"],
    ["followers", Heart, "games.modHub.followers"], ["views", Eye, "games.modHub.views"],
  ] as const;
  const exact = (key: typeof entries[number][0]) => typeof values?.[key] === "number" && Number.isFinite(values[key]) && values[key]! >= 0;
  const rounded = (key: typeof entries[number][0]) => /^[0-9]{1,4}(?:\.[0-9]{1,2})?[kKmMbB]$/.test(values?.rounded?.[key] ?? "") ? values?.rounded?.[key] : undefined;
  const available = entries.filter(([key]) => exact(key) || rounded(key));
  if (!available.length) return null;
  return <span className={`mod-project-stats${compact ? " is-compact" : ""}`}>{available.slice(0, compact ? 3 : 6).map(([key, Icon, label]) => <span key={key} title={`${exact(key) ? values![key]!.toLocaleString(language) : rounded(key)} ${t(label)}`}><Icon size={compact ? 14 : 17}/><strong>{exact(key) ? new Intl.NumberFormat(language, { notation: compact ? "compact" : "standard", maximumFractionDigits: 1 }).format(values![key]!) : rounded(key)}</strong><span className={compact ? "sr-only" : undefined}>{t(label)}</span></span>)}</span>;
}

export function ModCardBadges({ downloads, kind, label }: { downloads?: number | null; kind?: string; label?: string }) {
  const t = useT(), language = useUiLanguage();
  const Icon = kind === "modpack" ? Layers : kind === "resourcepack" ? Palette : kind === "shader" ? Sparkles : Box;
  const count = typeof downloads === "number" && Number.isFinite(downloads) && downloads >= 0 ? downloads : null;
  return <>{label && <span className="mod-poster-type"><Icon size={13}/><span>{label}</span></span>}{count !== null && <span className="mod-poster-downloads" title={`${count.toLocaleString(language)} ${t("games.minecraft.catalog.downloads")}`}><Download size={14}/><strong>{new Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 }).format(count)}</strong><span className="sr-only">{t("games.minecraft.catalog.downloads")}</span></span>}</>;
}
