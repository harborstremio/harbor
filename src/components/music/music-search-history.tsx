import { useEffect, useRef, useState } from "react";
import { Search, X } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { removeMusicSearch, type MusicSearchHistoryEntry } from "@/lib/music/search-history";
import "./music-search-history.css";
import { MusicSearchAudience } from "./music-search-audience";

export function MusicSearchHistory({ entries, onPick, activeIndex }: {
  entries: MusicSearchHistoryEntry[]; onPick: (entry: MusicSearchHistoryEntry) => void; activeIndex: number;
}) {
  const t = useT();
  return <div className="music-search-history">
    <h2 className="px-3 pb-2 pt-3 text-sm font-semibold">{t("music.search.recent")}</h2>
    {!entries.length && <p className="px-3 py-5 text-sm text-ink-muted">{t("music.search.historyEmpty")}</p>}
    {entries.map((entry, index) => <RecentSearchRow key={entry.id} entry={entry} active={activeIndex === index} onPick={onPick} />)}
  </div>;
}
function RecentSearchRow({ entry, active, onPick }: {
  entry: MusicSearchHistoryEntry; active: boolean; onPick: (entry: MusicSearchHistoryEntry) => void;
}) {
  const t = useT();
  const [removing, setRemoving] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active) row.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  useEffect(() => {
    if (!removing) return;
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
    const timer = setTimeout(() => removeMusicSearch(entry.id), delay);
    return () => clearTimeout(timer);
  }, [removing, entry.id]);
  const item = entry.item;
  const title = entry.query ?? (item?.kind === "artist" ? item.name : item && "title" in item ? item.title : "");
  const artwork = item && "artwork" in item ? item.artwork : undefined;
  const subtitle = item?.kind === "artist" ? t("music.search.artists") : item && "artist" in item ? item.artist : t("music.searchLabel");
  return <div ref={row} className="music-search-recent-row" data-removing={removing || undefined} data-active={active || undefined}>
    <div className="music-search-recent-inner">
      <button type="button" disabled={removing} onClick={() => onPick(entry)} className="music-search-recent-pick">
        <span className={`music-search-recent-art ${item?.kind === "artist" ? "rounded-full" : "rounded-md"}`}>
          {artwork ? <img src={artwork} alt="" loading="lazy" /> : <Search size={20} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1 text-start"><span className="block truncate text-sm font-semibold">{title}</span>
          <span className="mt-1 block truncate text-xs text-ink-muted">{item?.kind === "artist" && item.subtitle ? <MusicSearchAudience artist={item} /> : subtitle}</span></span>
      </button>
      <button type="button" disabled={removing} className="music-search-recent-remove"
        aria-label={t("music.search.removeRecent", { title })} onClick={() => {
          const next = row.current?.nextElementSibling ?? row.current?.previousElementSibling;
          if (document.activeElement === row.current?.querySelector('.music-search-recent-remove')) {
            next?.querySelector<HTMLButtonElement>("button")?.focus();
          }
          setRemoving(true);
        }}><X size={16} aria-hidden /></button>
    </div>
  </div>;
}
