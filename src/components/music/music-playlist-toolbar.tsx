import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Search, X } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { readMusicPreference, writeMusicPreference } from "@/lib/music/preferences";
import { MusicPlaylistGenres } from "./music-playlist-genres";
import { MusicServiceLogo } from "./music-service-logo";
import { MusicFilterIcon } from "./music-filter-icon";
import { sourceLabel } from "@/lib/music/source-label";
import type { PlaylistSort } from "@/lib/music/playlist-filters";
import type { PlaylistFilterController } from "@/lib/music/use-playlist-filters";
import "./music-playlist-toolbar.css";

export function MusicPlaylistToolbar({ controller: c, loading = false, recentLabel }: { controller: PlaylistFilterController; loading?: boolean; recentLabel?: string }) {
  const t = useT();
  const { filters: f, update } = c;
  const [searchOpen, setSearchOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [showGenres, setShowGenres] = useState(() => readMusicPreference("harbor.music.playlistGenreFilters") !== "hidden");
  const anchor = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const expanded = searchOpen || Boolean(f.query);
  const close = () => { if (menu.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true }); setOpen(false); };
  useEffect(() => { if (open) menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true }); }, [open]);
  const sorts: { value: PlaylistSort; label: string }[] = [
    { value: "default", label: t("music.sort.default") },
    ...(c.canSortAdded ? [{ value: "added" as const, label: recentLabel ?? t("music.playlistTools.added") }] : []),
    { value: "title", label: t("music.playlistTools.title") },
    { value: "artist", label: t("music.playlistTools.artist") },
    { value: "album", label: t("music.playlistTools.album") },
    { value: "duration", label: t("music.sort.duration") },
  ];
  const chosenSort = sorts.find(sort => sort.value === f.sort)?.label ?? sorts[0].label;
  const chooseSort = (value: PlaylistSort) => { update({ sort: value, descending: value === f.sort ? !f.descending : false }); close(); };
  const option = (label: string, selected: boolean, run: () => void, icon?: ReactNode) => (
    <button key={label} type="button" role="menuitemradio" aria-checked={selected} onClick={() => { run(); close(); }}>
      <span className="music-playlist-option-label">{icon}{label}</span>{selected && <Check size={16} aria-hidden />}
    </button>
  );
  return (
    <div className="music-playlist-tools" aria-busy={loading || c.filtering}>
      <div className="music-playlist-tools-top">
        <div className="music-playlist-tools-status" role="status" aria-live="polite">
          <span>{t("music.card.trackCount", { count: c.tracks.length })}</span>
          {c.active && <button type="button" onClick={c.reset}>{t("music.playlistTools.clear")}</button>}
        </div>
        <div className="music-playlist-tools-actions">
          <div className="music-playlist-tools-search" data-expanded={expanded || undefined}>
            {!expanded ? <HoverTooltip label={t("music.filter.tracks")}><button ref={searchTrigger} type="button" className="music-playlist-tools-icon" aria-label={t("music.filter.tracks")} onClick={() => { setSearchOpen(true); requestAnimationFrame(() => search.current?.focus()); }}><Search size={20} aria-hidden /></button></HoverTooltip> : <>
              <Search size={17} aria-hidden />
              <input ref={search} type="search" value={f.query} maxLength={200} placeholder={t("music.filter.tracks")} aria-label={t("music.filter.tracks")}
                onChange={event => update({ query: event.target.value })}
                onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); update({ query: "" }); setSearchOpen(false); requestAnimationFrame(() => searchTrigger.current?.focus()); } }} />
              <button type="button" className="music-playlist-tools-icon" aria-label={t("music.search.clear")} onClick={() => { if (f.query) { update({ query: "" }); search.current?.focus(); } else { setSearchOpen(false); requestAnimationFrame(() => searchTrigger.current?.focus()); } }}><X size={17} aria-hidden /></button>
            </>}
          </div>
          <button ref={anchor} type="button" className="music-playlist-tools-sort" aria-label={t("music.playlistTools.options")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span>{chosenSort}</span>{f.descending && <ArrowUp size={14} aria-hidden />}<MusicFilterIcon />
            {(f.source !== "all" || f.content !== "all") && <i aria-hidden />}
          </button>
        </div>
      </div>
      {showGenres && c.genreIds.length > 0 && <MusicPlaylistGenres genres={c.genreIds} selected={f.genre} onSelect={genre => update({ genre })} />}
      {showGenres && c.genresLoading && <div className="music-playlist-genre-loading" role="status" aria-label={t("music.loading")}>
        {[48, 82, 68].map(width => <span key={width} className="music-playlist-genre-placeholder" style={{ width }} aria-hidden="true" />)}
      </div>}
      <AnchoredMenu open={open} anchorRef={anchor} onClose={close} width={240}>
        <div ref={menu} role="menu" aria-label={t("music.playlistTools.options")} className="music-playlist-tools-menu" onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
          if (event.key === "Tab") { close(); return; }
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]')];
          const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }}>
          <div role="group" aria-label={t("music.sort.label")}><p>{t("music.sort.label")}</p>
            {sorts.map(({ value, label }) => <button key={value} type="button" role="menuitemradio" aria-checked={f.sort === value} onClick={() => chooseSort(value)}><span>{label}</span>{f.sort === value && (value === "default" ? <Check size={16} aria-hidden /> : f.descending ? <ArrowUp size={16} aria-hidden /> : <ArrowDown size={16} aria-hidden />)}</button>)}
          </div>
          <div role="group" aria-label={t("music.playlistTools.view")}><p>{t("music.playlistTools.view")}</p>
            {option(t("music.playlistTools.list"), f.view === "list", () => update({ view: "list" }))}
            {option(t("music.playlistTools.compact"), f.view === "compact", () => update({ view: "compact" }))}
            {c.genreIds.length > 0 && <button type="button" role="menuitemcheckbox" aria-checked={showGenres} onClick={() => {
              setShowGenres(!showGenres);
              writeMusicPreference("harbor.music.playlistGenreFilters", showGenres ? "hidden" : "visible");
              if (showGenres) update({ genre: null });
              close();
            }}><span>{t("music.playlistTools.showGenres")}</span>{showGenres && <Check size={16} aria-hidden />}</button>}
          </div>
          {c.sources.length > 1 && <div role="group" aria-label={t("music.playlistTools.source")}><p>{t("music.playlistTools.source")}</p>
            {option(t("music.filter.all"), f.source === "all", () => update({ source: "all" }))}
            {c.sources.map(source => option(sourceLabel(source), f.source === source, () => update({ source }), <MusicServiceLogo source={source} size={18} />))}
          </div>}
          <div role="group" aria-label={t("music.playlistTools.content")}><p>{t("music.playlistTools.content")}</p>
            {(["all", "explicit", "clean"] as const).map(content => option(t(content === "all" ? "music.filter.all" : `music.playlistTools.${content}`), f.content === content, () => update({ content })))}
          </div>
        </div>
      </AnchoredMenu>
    </div>
  );
}
