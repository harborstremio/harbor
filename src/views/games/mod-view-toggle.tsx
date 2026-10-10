import { useState } from "react";
import { useT } from "@/lib/i18n";
import "./mod-identity.css";

export type ModCatalogView = "grid" | "list";
export function useModCatalogView(key: string, fallback: ModCatalogView) {
  const [view, setView] = useState<ModCatalogView>(() => { try { const saved = localStorage.getItem(`harbor:mods:view:${key}`); return saved === "grid" || saved === "list" ? saved : fallback; } catch { return fallback; } });
  return [view, (next: ModCatalogView) => { setView(next); try { localStorage.setItem(`harbor:mods:view:${key}`, next); } catch { /* The view still works when storage is unavailable. */ } }] as const;
}
export function ModViewToggle({ value, change }: { value: ModCatalogView; change: (view: ModCatalogView) => void }) {
  const t = useT();
  return <div className="mod-view-toggle">{(["list", "grid"] as const).map(view => <button key={view} type="button" aria-label={t(`games.library.${view}`)} title={t(`games.library.${view}`)} aria-pressed={value === view} onClick={() => change(view)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{view === "grid" ? <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> : <><rect x="3" y="4" width="5" height="5" rx="1"/><rect x="3" y="15" width="5" height="5" rx="1"/><path d="M12 5h9M12 8h6M12 16h9M12 19h6"/></>}</svg></button>)}</div>;
}
