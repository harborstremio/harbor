import {
  Check,
  FolderOpen,
  Languages,
  Loader2,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Flag } from "@/components/flag";
import { markImportedSub } from "@/lib/player/imported-subs";
import { useT } from "@/lib/i18n";
import { openSyncBar } from "@/lib/player/sub-sync";
import { Tooltip } from "../transport/tooltip";
import { SearchSection } from "./search-section";
import { VariantRow } from "./variant-row";
import type { SubtitleMenuProps } from "./types";
import { groupByLang, isVeryNewRelease } from "./utils";

type SourceFilter = "all" | "embedded" | "external";
const ALL_LANGS = "__all__";

export function MenuBody(props: SubtitleMenuProps & { onClose: () => void }) {
  const tr = useT();
  const { tracks, selectedId, onSelect, onClose, delaySec, metaReleaseDate, onOpenStyleBar } =
    props;
  const groups = useMemo(() => groupByLang(tracks), [tracks]);
  const [searchSettled, setSearchSettled] = useState(false);
  const [activeLang, setActiveLang] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [hideHI, setHideHI] = useState(false);
  const [forcedOnly, setForcedOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [justImported, setJustImported] = useState<string | null>(null);

  useEffect(() => {
    if (tracks.length > 0) return;
    setSearchSettled(false);
    const timer = setTimeout(() => setSearchSettled(true), 9000);
    return () => clearTimeout(timer);
  }, [tracks.length]);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveLang(null);
      return;
    }
    if (activeLang === ALL_LANGS) return;
    if (!activeLang || !groups.some((g) => g.langKey === activeLang)) {
      const sel = groups.find((g) => g.variants.some((v) => v.id === selectedId));
      setActiveLang(sel?.langKey ?? groups[0].langKey);
    }
  }, [groups, activeLang, selectedId]);

  const veryNewMovie = useMemo(() => isVeryNewRelease(metaReleaseDate), [metaReleaseDate]);
  const allLangs = activeLang === ALL_LANGS;
  const activeGroup = useMemo(
    () => groups.find((g) => g.langKey === activeLang) ?? null,
    [groups, activeLang],
  );
  const visibleVariants = useMemo(() => {
    const list = allLangs ? tracks : (activeGroup?.variants ?? []);
    return list.filter((t) => {
      if (sourceFilter === "embedded" && t.external) return false;
      if (sourceFilter === "external" && !t.external) return false;
      if (hideHI && t.hearingImpaired) return false;
      if (forcedOnly && !t.forced) return false;
      return true;
    });
  }, [allLangs, tracks, activeGroup, sourceFilter, hideHI, forcedOnly]);

  const totalEmbedded = tracks.filter((t) => !t.external).length;
  const totalExternal = tracks.filter((t) => t.external).length;
  const offSelected = selectedId == null;
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [localError, setLocalError] = useState<string | null>(null);
  const delayNonZero = delaySec !== 0;

  const loadLocal = async () => {
    setLocalError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        multiple: false,
        filters: [{ name: "Subtitles", extensions: ["srt", "ass", "ssa", "vtt", "sub"] }],
      });
      if (typeof path !== "string") return;
      const name = path.split(/[\\\/]/).pop() || tr("Local subtitle");
      const ok = await props.onAddSubtitle(path, undefined, name);
      if (ok === false) {
        setLocalError(tr("Couldn't load that subtitle file. Try another."));
        return;
      }
      markImportedSub(name);
      setActiveLang(ALL_LANGS);
      setJustImported(name);
      window.setTimeout(() => onClose(), 1700);
    } catch (e) {
      console.warn("[subtitles] local load failed", e);
      setLocalError(tr("Couldn't load that subtitle file. Try another."));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between border-b border-edge-soft px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[13.5px] font-semibold text-ink">{tr("Subtitles")}</span>
          {tracks.length > 0 && (
            <span className="text-[11.5px] tabular-nums text-ink-subtle">{tracks.length}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* ── Sync button → opens the floating player-level bar ── */}
          <Tooltip label={tr("Subtitle sync")} side="bottom" align="end">
            <button
              type="button"
              onClick={() => {
                openSyncBar();
                onClose();
              }}
              aria-label={tr("Subtitle sync")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Timer size={16} strokeWidth={2} />
              {/* badge when delay is active */}
              {delayNonZero && (
                <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
          </Tooltip>

          {/* ── Style bar button ── */}
          {onOpenStyleBar && (
            <button
              type="button"
              onClick={() => {
                onOpenStyleBar();
                onClose();
              }}
              aria-label={tr("Subtitle appearance")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <SlidersHorizontal size={18} strokeWidth={2} />
            </button>
          )}

          <button
            onClick={onClose}
            aria-label={tr("Close")}
            data-tv-modal-close
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Language sidebar */}
        <aside className="flex w-[128px] shrink-0 flex-col gap-0.5 overflow-y-auto border-e border-edge-soft bg-canvas/30 p-2">
          <button
            onClick={() => {
              if (offSelected) return;
              onSelect(null);
              onClose();
            }}
            disabled={offSelected}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-[12.5px] font-semibold transition-colors ${
              offSelected
                ? "text-ink-subtle"
                : "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                offSelected ? "bg-raised text-ink-subtle" : "bg-accent text-canvas"
              }`}
            >
              {offSelected ? null : <Check size={9} strokeWidth={3} />}
            </span>
            {offSelected ? tr("Off") : tr("On")}
          </button>

          {groups.length > 0 && (
            <div className="mt-1.5 mb-0.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {tr("Languages")}
            </div>
          )}
          {groups.length > 1 && (
            <button
              onClick={() => setActiveLang(ALL_LANGS)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-[12.5px] font-medium transition-colors ${
                allLangs
                  ? "bg-elevated text-ink ring-1 ring-edge"
                  : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              <Languages size={14} strokeWidth={2} className="shrink-0" />
              <span className="flex-1 truncate">{tr("All languages")}</span>
              <span className="text-[10.5px] tabular-nums text-ink-subtle">{tracks.length}</span>
            </button>
          )}
          {groups.map((g) => {
            const isActive = activeLang === g.langKey;
            const hasSelected = g.variants.some((v) => v.id === selectedId);
            return (
              <button
                key={g.langKey}
                onClick={() => setActiveLang(g.langKey)}
                className={`group flex items-center gap-2 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors ${
                  isActive
                    ? "bg-elevated text-ink ring-1 ring-edge"
                    : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                }`}
              >
                <Flag language={g.langDisplay} size="sm" showLabel={false} />
                <span className="flex-1 truncate font-medium">{g.langDisplay}</span>
                {hasSelected && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
                <span className="text-[10.5px] tabular-nums text-ink-subtle">
                  {g.variants.length}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Track list section */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!searchOpen && tracks.length > 0 && (activeGroup || allLangs) && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-edge-soft bg-canvas/15 px-3 py-2">
              <Tab active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>
                {tr("All")} <Count value={tracks.length} />
              </Tab>
              <Tab
                active={sourceFilter === "embedded"}
                onClick={() => setSourceFilter("embedded")}
                disabled={totalEmbedded === 0}
              >
                {tr("Embedded")} <Count value={totalEmbedded} />
              </Tab>
              <Tab
                active={sourceFilter === "external"}
                onClick={() => setSourceFilter("external")}
                disabled={totalExternal === 0}
              >
                {tr("External")} <Count value={totalExternal} />
              </Tab>
              <span className="ms-auto flex items-center gap-1">
                <ToggleChip
                  active={!hideHI}
                  onClick={() => setHideHI((v) => !v)}
                  label={tr("HI")}
                  hint={hideHI ? tr("Hidden") : tr("Shown")}
                />
                <ToggleChip
                  active={forcedOnly}
                  onClick={() => setForcedOnly((v) => !v)}
                  label={tr("Forced")}
                />
              </span>
            </div>
          )}

          {searchOpen ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <SearchSection {...props} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {justImported && <ImportBanner name={justImported} />}
              {tracks.length === 0 ? (
                <EmptyState searchSettled={searchSettled} veryNewMovie={veryNewMovie} />
              ) : visibleVariants.length === 0 ? (
                <p className="px-5 py-6 text-[13.5px] text-ink-muted">
                  {tr("No tracks match these filters. Try toggling HI/SDH or Forced.")}
                </p>
              ) : (
                <div className="flex flex-col gap-0.5 p-2">
                  {visibleVariants.map((t) => (
                    <VariantRow
                      key={t.id}
                      track={t}
                      selected={t.id === selectedId}
                      onPick={() => {
                        onSelect(t.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {localError && (
            <div className="shrink-0 border-t border-edge-soft bg-danger/10 px-3 py-1.5 text-[11.5px] text-danger">
              {localError}
            </div>
          )}

          <div className="flex shrink-0 items-stretch border-t border-edge-soft">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex flex-1 items-center gap-2 px-3 py-2 text-start text-[12px] font-semibold text-ink-muted transition-colors hover:bg-canvas/40 hover:text-ink"
            >
              <SearchIcon size={12} strokeWidth={2.2} />
              {searchOpen ? tr("Hide search") : tr("Find more subtitles")}
            </button>
            {isTauri && (
              <Tooltip label={tr("Load a .srt or .ass from your computer")} align="end">
                <button
                  onClick={() => void loadLocal()}
                  className="flex h-full shrink-0 items-center gap-2 border-s border-edge-soft px-3 py-2 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-canvas/40 hover:text-ink"
                >
                  <FolderOpen size={12} strokeWidth={2.2} />
                  {tr("Load file")}
                </button>
              </Tooltip>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function Tab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors disabled:opacity-40 ${
        active
          ? "bg-elevated text-ink ring-1 ring-edge"
          : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return <span className="text-[11.5px] tabular-nums text-ink-subtle">{value}</span>;
}

function ToggleChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`flex h-6 items-center rounded-full px-2 text-[11px] font-semibold transition-colors ${
        active ? "bg-accent text-canvas" : "bg-raised text-ink-muted hover:bg-elevated"
      }`}
    >
      {label}
    </button>
  );
}

function ImportBanner({ name }: { name: string }) {
  const tr = useT();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={`mx-2 mt-2 flex items-center gap-3 overflow-hidden rounded-xl border border-accent/35 bg-accent/10 px-3.5 py-2.5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        shown ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.97] opacity-0"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_0_18px_-2px_var(--color-accent)]">
        <Check size={16} strokeWidth={3} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
        <span className="text-[11px] font-medium text-accent">
          {tr("Imported and now playing")}
        </span>
      </div>
      <Sparkles size={15} className="ms-auto shrink-0 text-accent" />
    </div>
  );
}

function EmptyState({
  searchSettled,
  veryNewMovie,
}: {
  searchSettled: boolean;
  veryNewMovie: boolean;
}) {
  const tr = useT();
  if (!searchSettled) {
    return (
      <div className="flex items-center gap-2.5 px-5 py-6 text-[13.5px] text-ink-muted">
        <Loader2 size={14} className="animate-spin text-ink-subtle" />
        {tr("Looking for subtitles…")}
      </div>
    );
  }
  if (veryNewMovie) {
    return (
      <div className="flex flex-col gap-1.5 px-5 py-6 text-[13.5px] leading-snug text-ink-muted">
        <span className="text-[14px] font-semibold text-ink">{tr("Movie's too new")}</span>
        <span>
          {tr(
            "Subtitles haven't been published yet. Try search below or check back in a few days.",
          )}
        </span>
      </div>
    );
  }
  return (
    <p className="px-5 py-6 text-[13.5px] text-ink-muted">
      {tr("No subtitles found yet. Try the search at the bottom.")}
    </p>
  );
}
