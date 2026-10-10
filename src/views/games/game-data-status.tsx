import { useT, useUiLanguage } from "@/lib/i18n";

/** A quiet provenance line for an older snapshot, kept beside the affected content. */
export function GameDataStatus({ at, refresh, busy = false }: { at?: number; refresh?: () => void; busy?: boolean }) {
  const t = useT();
  const language = useUiLanguage();
  if (at === undefined) return null;
  return <div className="games-data-status" role="status">
    <span>{t("games.cache.saved", { date: new Date(at).toLocaleString(language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })}</span>
    {refresh && <button onClick={refresh} disabled={busy}>{t(busy ? "games.cache.refreshing" : "games.cache.refresh")}</button>}
  </div>;
}
