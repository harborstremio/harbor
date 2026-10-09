import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, Globe2, Library, LoaderCircle, Search, X } from "@/components/icons/music-icons";
import { AnchoredMenu } from "@/components/anchored-menu";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import {
  useMusicConnections,
  type MusicConnectionsStatus,
} from "@/components/music/music-connections";
import { useT } from "@/lib/i18n";
import { MusicSearchSuggest, useMusicSuggest } from "@/components/music/music-search-suggest";
import type { MusicCatalogItem } from "@/lib/music/types";
import { rememberMusicSearch, rememberMusicSearchItem, useMusicSearchHistory, type MusicSearchHistoryEntry } from "@/lib/music/search-history";
import { MusicSearchHistory } from "./music-search-history";

export function MusicMast({
  onSubmit,
  onClear,
  onPick,
  initialQuery = "",
  searching = false,
  className = "",
}: {
  onSubmit: (query: string, connector: string | null) => void;
  onClear?: () => void;
  onPick?: (item: MusicCatalogItem) => void;
  initialQuery?: string;
  searching?: boolean;
  className?: string;
}) {
  const t = useT();
  const { connections, status, error, connected, reload } = useMusicConnections();
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  const [scope, setScope] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const history = useMusicSearchHistory();

  const { groups: suggestGroups, loading: suggesting } = useMusicSuggest(query, scope, focused && !dismissed && !!onPick);
  const suggestFlat = suggestGroups.flatMap((group) => group.items);
  const showingHistory = !query.trim();
  const suggestOpen = focused && !dismissed && !!onPick;
  const optionCount = showingHistory ? history.length : suggestFlat.length;

  useEffect(() => setActiveIndex(-1), [query, scope]);

  const choose = (item: MusicCatalogItem) => {
    rememberMusicSearchItem(item);
    setDismissed(true);
    setActiveIndex(-1);
    inputRef.current?.blur();
    onPick?.(item);
  };

  const recall = (entry: MusicSearchHistoryEntry) => {
    if (entry.item) { choose(entry.item); return; }
    if (!entry.query) return;
    const connector = scopeOptions.some((option) => option.id === entry.scope) ? entry.scope! : null;
    setQuery(entry.query);
    setScope(connector);
    setDismissed(true);
    inputRef.current?.blur();
    rememberMusicSearch(entry.query, connector);
    onSubmit(entry.query, connector);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && suggestOpen) {
      event.preventDefault();
      setDismissed(true);
      return;
    }
    if (!suggestOpen || !optionCount) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % optionCount);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? optionCount - 1 : current - 1));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      if (showingHistory && history[activeIndex]) recall(history[activeIndex]);
      else if (suggestFlat[activeIndex]) choose(suggestFlat[activeIndex]);
    }
  };

  const scopeOptions = useMemo(
    () =>
      connections.filter(
        (row) => row.status === "connected" && row.capabilities.includes("search"),
      ),
    [connections],
  );

  useEffect(() => {
    if (scope && !scopeOptions.some((row) => row.id === scope)) setScope(null);
  }, [scope, scopeOptions]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    chipRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("button");
    first?.focus();
  }, [menuOpen]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) return;
    setDismissed(true);
    inputRef.current?.blur();
    rememberMusicSearch(next, scope);
    onSubmit(next, scope);
  };

  const clear = () => {
    setQuery("");
    setDismissed(false);
    onClear?.();
    inputRef.current?.focus();
  };

  const pick = (connector: string | null) => {
    setScope(connector);
    setMenuOpen(false);
    chipRef.current?.focus();
    const next = query.trim();
    if (next) onSubmit(next, connector);
  };

  const activeScope = scope ? scopeOptions.find((row) => row.id === scope) : undefined;
  const scopeLabel = activeScope ? activeScope.name : t("music.search.scopeAll");
  const scopeTitle = activeScope
    ? t("music.search.scope", { source: activeScope.name })
    : t("music.search.scopeAll");

  return (
    <header
      className={`music-page-mast flex min-w-0 flex-wrap items-center justify-between gap-5 ${className}`}
    >
      <div className="min-w-0">
        <h1 tabIndex={-1} className="text-[32px] font-bold leading-tight tracking-tight text-ink">
          {t("music.title")}
        </h1>
        <div
          aria-live="polite"
          className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-[13px] text-ink-subtle"
        >
          <SourceCount
            status={status}
            error={error}
            connected={connected}
            total={connections.length}
            onRetry={reload}
          />
        </div>
      </div>

      <form
        ref={formRef}
        role="search"
        onSubmit={submit}
        className="flex h-11 w-full max-w-full min-w-0 items-center gap-2 rounded-lg bg-elevated px-2 ring-1 ring-edge-soft/70 transition-[box-shadow,background-color] duration-200 ease-out focus-within:ring-ink-muted sm:w-[min(400px,100%)]"
      >
        <button
          type="submit"
          aria-label={t("music.searchLabel")}
          className="grid size-[29px] shrink-0 place-items-center rounded-full text-ink-muted transition-colors duration-200 ease-out hover:text-ink"
        >
          {searching ? (
            <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={15} aria-hidden="true" />
          )}
        </button>
        <input
          ref={inputRef}
          data-music-mast-search
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setDismissed(false);
          }}
          onFocus={() => { setFocused(true); setDismissed(false); }}
          onClick={() => { setFocused(true); setDismissed(false); }}
          onBlur={(event) => {
            const next = event.relatedTarget as HTMLElement | null;
            if (next && !formRef.current?.contains(next) && !next.closest("[data-music-search-panel]")) setDismissed(true);
          }}
          onKeyDown={onInputKeyDown}
          placeholder={t("music.searchPlaceholder")}
          aria-label={t("music.searchLabel")}
          aria-autocomplete="list"
          aria-expanded={suggestOpen}
          type="search"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t("music.search.clear")}
            className="grid size-[27px] shrink-0 place-items-center rounded-full text-ink-subtle transition-colors duration-200 ease-out hover:text-ink"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
        {scopeOptions.length ? (
          <button
            ref={chipRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label={scopeTitle}
            title={scopeTitle}
            className="flex h-[29px] min-w-0 max-w-[136px] shrink-0 items-center gap-1 rounded-full bg-canvas/60 px-2.5 text-[11px] font-semibold text-ink-muted transition-colors duration-200 ease-out hover:text-ink"
          >
            <span className="truncate">{scopeLabel}</span>
            <ChevronDown size={12} aria-hidden="true" className="shrink-0" />
          </button>
        ) : null}
      </form>

      <AnchoredMenu
        anchorRef={formRef}
        open={suggestOpen && !menuOpen}
        onClose={() => setDismissed(true)}
        backdrop={false}
      >
        {showingHistory ? <div data-music-search-panel className="harbor-float animate-menu-in max-h-[min(560px,60vh)] overflow-y-auto overscroll-contain rounded-md bg-elevated ring-1 ring-edge-soft">
          <MusicSearchHistory entries={history} activeIndex={activeIndex} onPick={recall} />
        </div> : suggestFlat.length ? <MusicSearchSuggest
          groups={suggestGroups}
          activeIndex={activeIndex}
          onPick={choose}
          onHover={setActiveIndex}
        /> : <div className="rounded-md bg-elevated p-5 text-sm text-ink-muted" role="status">{t(query.trim().length < 2 ? "music.searchPlaceholder" : suggesting ? "music.loading" : "music.searchEmpty")}</div>}
      </AnchoredMenu>

      <AnchoredMenu anchorRef={chipRef} open={menuOpen} onClose={closeMenu} width={224}>
        <div
          ref={menuRef}
          className="harbor-float animate-menu-in overflow-hidden rounded-md bg-elevated p-1 ring-1 ring-edge-soft"
        >
          <ScopeOption
            label={t("music.search.scopeAll")}
            icon={<Globe2 size={16} aria-hidden="true" />}
            selected={scope === null}
            onSelect={() => pick(null)}
          />
          {scopeOptions.map((row) => (
            <ScopeOption
              key={row.id}
              label={row.name}
              icon={<MusicServiceLogo source={row.id} size={16} fallback={row.kind === "catalog" ? <Library size={16} aria-hidden="true" /> : undefined} />}
              detail={row.account}
              selected={scope === row.id}
              onSelect={() => pick(row.id)}
            />
          ))}
        </div>
      </AnchoredMenu>
    </header>
  );
}

function ScopeOption({
  label,
  icon,
  detail,
  selected,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-start text-[12.5px] transition-colors duration-200 ease-out hover:bg-raised ${
        selected ? "text-ink" : "text-ink-muted"
      }`}
    >
      <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1 truncate">
        {label}
        {detail ? <span className="ms-1.5 text-ink-subtle">{detail}</span> : null}
      </span>
      {selected ? <Check size={13} aria-hidden="true" className="shrink-0" /> : null}
    </button>
  );
}

function SourceCount({
  status,
  error,
  connected,
  total,
  onRetry,
}: {
  status: MusicConnectionsStatus;
  error: string;
  connected: number;
  total: number;
  onRetry: () => void;
}) {
  const t = useT();

  if (status === "loading") {
    return <span aria-hidden="true" className="harbor-shimmer block h-3 w-40 rounded-full" />;
  }

  if (status === "error") {
    return (
      <>
        <span className="max-w-[42ch] truncate" title={error}>
          {error || t("music.error.load")}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-ink underline underline-offset-4 transition-colors duration-200 ease-out hover:bg-elevated"
        >
          {t("music.offline.retry")}
        </button>
      </>
    );
  }

  if (total === 0) return <span>{t("music.mast.noSources")}</span>;

  return <span>{t("music.footer.sourceCount", { connected, total })}</span>;
}
