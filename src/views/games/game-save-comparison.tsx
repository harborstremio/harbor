import { useEffect, useId, useRef, useState } from "react";
import { File, Folder, Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { filterSaveChanges, saveChangeSide, type SaveChangeFilter, type SaveRestorePlan } from "@/lib/games/saves";
import { transferBytes } from "@/lib/games/transfers";

export function GameSaveComparison({ plan }: { plan: SaveRestorePlan }) {
  const t = useT(), id = useId();
  const [query, setQuery] = useState(""), [filter, setFilter] = useState<SaveChangeFilter>("all"), [limit, setLimit] = useState(80);
  const table = useRef<HTMLTableElement>(null), search = useRef<HTMLInputElement>(null), previousLimit = useRef(limit);
  const changes = filterSaveChanges(plan.changes, query, filter);
  const reset = () => { setQuery(""); setFilter("all"); setLimit(80); search.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (limit > previousLimit.current) table.current?.querySelectorAll<HTMLElement>("tbody th")[previousLimit.current]?.focus();
    previousLimit.current = limit;
  }, [limit]);
  return <section className="games-save-comparison" aria-labelledby={id}>
    <div className="games-save-comparison-heading"><h3 id={id}>{t("games.backups.compare.title")}</h3><span role="status">{t("games.backups.compare.shown", { shown: Math.min(limit, changes.length), total: plan.changes.length })}</span></div>
    <div className="games-save-change-filters" role="group" aria-label={t("games.backups.compare.filter")}>
      {(["all", "replace", "add", "remove"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(80); }}>{t(value === "all" ? "games.backups.compare.all" : `games.backups.change.${value}`)}</button>)}
    </div>
    <label className="games-search"><Search size={16} aria-hidden="true" /><input ref={search} aria-label={t("games.backups.searchChanges")} placeholder={t("games.backups.searchChanges")} value={query} onChange={event => { setQuery(event.target.value); setLimit(80); }} /></label>
    {changes.length ? <table ref={table} className="games-save-comparison-table">
      <thead><tr><th scope="col">{t("games.backups.compare.path")}</th><th scope="col">{t("games.backups.compare.current")}</th><th scope="col">{t("games.backups.compare.snapshot")}</th></tr></thead>
      <tbody>{changes.slice(0, limit).map(change => <tr key={`${change.directory}:${change.path}`}>
        <th scope="row" tabIndex={-1}><span className="games-save-change-path">{change.directory ? <Folder size={15} aria-hidden="true" /> : <File size={15} aria-hidden="true" />}<bdi>{change.path}{change.directory ? "/" : ""}</bdi></span><span className="games-save-change-kind" data-change={change.status}>{t(`games.backups.change.${change.status}`)}{!change.directory && change.status === "replace" && change.currentBytes !== null && change.currentBytes === change.snapshotBytes && saveChangeSide(change, "current").kind === "file" && <span> · {t("games.backups.compare.sameSize")}</span>}</span></th>
        {(["current", "snapshot"] as const).map(side => {
          const value = saveChangeSide(change, side);
          return <td key={side} data-kind={value.kind}><span className="games-save-comparison-mobile-label" aria-hidden="true">{t(`games.backups.compare.${side}`)}</span><bdi>{value.kind === "file" ? transferBytes(value.bytes) : t(`games.backups.compare.${value.kind}`)}</bdi></td>;
        })}
      </tr>)}</tbody>
    </table> : <div className="games-save-comparison-empty"><p>{t("games.backups.compare.noMatch")}</p><button type="button" className="games-button" onClick={reset}>{t("games.backups.compare.clear")}</button></div>}
    {changes.length > limit && <button type="button" className="games-button games-save-comparison-more" onClick={() => setLimit(value => value + 80)}>{t("games.backups.moreChanges")}</button>}
  </section>;
}
