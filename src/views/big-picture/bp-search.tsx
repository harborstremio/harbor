import { useCallback, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { SFX } from "@/lib/sfx";
import { isAndroid } from "@/lib/platform";
import { BpKeyboardSheet } from "./bp-keyboard-sheet";
import { setBpFocus, markBpInteracted } from "./use-bp-focus";
import { BpMosaic } from "./bp-mosaic";
import { BpResultCard } from "./bp-result-card";
import { useBpT } from "./bp-i18n";
import { useBpCatalog } from "./use-bp-catalog";
import { bpSectionCount, useBpSearch, type BpSearchFilter, type BpSearchSection } from "./use-bp-search";
import { BpRecentRow, BpSearchField } from "./search/bp-search-input";
import { bpSearchCells } from "./search/bp-search-cells";
import { bpGroupRenders, type BpGroupShape, type BpGroupSource, type BpGroupState } from "./search/bp-search-group";
import { BpSearchResults, bpSearchSlotsEmpty, type BpSearchSlot } from "./search/bp-search-results";
import { BpEmptyState } from "./bp-empty";
import { bpSearchEmptyMessage } from "./search/bp-search-empty";

const CHIPS_SCOPE = { containIntrinsicSize: "auto 76px" } as const;

const IDLE_WASH =
  "linear-gradient(to bottom, color-mix(in oklab, var(--bp-page) 74%, transparent) 0%, color-mix(in oklab, var(--bp-page) 82%, transparent) 46%, color-mix(in oklab, var(--bp-page) 92%, transparent) 100%)";

// Results own the screen once there are any, so the mosaic sinks rather than
// unmounting. Unmounting it pops, and re-mounting it on the next empty field
// pays for the poster columns twice.
const RESULTS_WASH =
  "linear-gradient(to bottom, color-mix(in oklab, var(--bp-page) 92%, transparent) 0%, color-mix(in oklab, var(--bp-page) 95%, transparent) 46%, color-mix(in oklab, var(--bp-page) 98%, transparent) 100%)";

// Exhaustive on purpose. A new section kind should fail the build here rather
// than fall through to a skeleton the wrong shape, which changes the row height
// on settle and drags the rail out from under a ring that is already moving.
const SHAPE_OF: Record<BpSearchSection["kind"], BpGroupShape> = {
  top: "hero",
  titles: "wide",
  people: "people",
  anime: "poster",
  manga: "poster",
  livetv: "card",
  collections: "banner",
  addonIndex: "card",
};

// Three bands, so the rail reads as What we found / Everything else / Where it
// came from rather than one undifferentiated stack of twenty rows.
const BAND_OF: Record<BpSearchFilter, string> = {
  all: "core",
  top: "core",
  movie: "core",
  series: "core",
  people: "core",
  anime: "more",
  manga: "more",
  livetv: "more",
  collections: "more",
  characters: "more",
  addons: "addons",
};

function bpAddonSource(s: BpSearchSection): BpGroupSource | undefined {
  if (!s.key.startsWith("addon:")) return undefined;
  return { id: s.key.slice("addon:".length), name: s.label, logo: s.logo };
}

// The engine's four states, kept whole. An addon row reports what the addon
// actually did; every other slot is pending until the fixed sources settle and
// then simply has content or does not.
function bpSlotState(s: BpSearchSection): BpGroupState {
  if (s.pending) return "pending";
  if (s.addonState) return s.addonState;
  return bpSectionCount(s) > 0 ? "ok" : "empty";
}

export function BpSearch({ onSelect }: { onSelect: (m: Meta) => void }) {
  const { settings } = useSettings();
  const t = useBpT();
  const { query, recent, recordRecent, clearRecent } = useSearch();
  const { openManga } = useView();

  // The filter is chosen against one query and is meaningless against the next,
  // so it is derived rather than stored. A chip that survives into a new search
  // collapses every later result set to one group with nothing on screen saying
  // why. Deriving it also keeps the reset out of an effect, so the rail is never
  // built filtered and then rebuilt unfiltered a frame later.
  const [chosen, setChosen] = useState<{ q: string; id: BpSearchFilter }>({ q: "", id: "all" });
  const filter: BpSearchFilter = chosen.q === query ? chosen.id : "all";
  const search = useBpSearch(filter);
  const { setQuery, clear, busy, settled, idle, active, chips, slots, total, retry } = search;
  const { hasResults, noResults, tmdbUnavailable, filterStale } = search;
  const { rows } = useBpCatalog();

  const failedCount = slots.reduce((n, s) => (s.addonState === "failed" ? n + 1 : n), 0);

  const suggestions = useMemo(() => {
    if (!idle) return [];
    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const row of rows) {
      for (const m of row.metas) {
        if (seen.has(m.id) || !m.poster) continue;
        seen.add(m.id);
        out.push(m);
        if (out.length >= 60) return out;
      }
    }
    return out;
  }, [idle, rows]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [typing, setTyping] = useState(false);

  // The keyboard is a bottom sheet that only exists once the field is activated.
  // The sheet lands the ring on its own first key when it opens, so this just
  // flips the state; on Android the OS keyboard drives the native input instead.
  const startTyping = useCallback(() => {
    markBpInteracted();
    setTyping(true);
    if (isAndroid()) inputRef.current?.focus();
  }, []);

  // The only way out of the sheet, wired to the Done key and to Back. The ring
  // returns to the field so the next OK reopens the keyboard where it left off.
  const stopTyping = useCallback(() => {
    setTyping(false);
    setBpFocus(inputRef.current, { silent: true });
  }, []);

  const mosaicPool = useMemo(() => {
    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const row of rows) {
      for (const m of row.metas) {
        if (seen.has(m.id) || !m.poster) continue;
        seen.add(m.id);
        out.push(m);
        if (out.length >= 42) return out;
      }
    }
    return out;
  }, [rows]);

  const commit = useCallback(() => {
    if (!idle) recordRecent(query);
  }, [idle, query, recordRecent]);

  const pick = useCallback(
    (m: Meta) => {
      commit();
      onSelect(m);
    },
    [commit, onSelect],
  );

  const handlers = useMemo(
    () => ({ onSelect: pick, onCommit: commit, openManga }),
    [pick, commit, openManga],
  );

  // One renderer for every state. Splitting settled rows off into a second row
  // component is what made the addon mark appear only while a row was empty and
  // vanish the instant it had something to attribute.
  const railSlots = useMemo<BpSearchSlot[]>(
    () =>
      slots.map((s) => ({
        key: s.key,
        band: BAND_OF[s.group],
        title: s.label,
        state: bpSlotState(s),
        shape: SHAPE_OF[s.kind],
        cells: bpSearchCells(s, handlers),
        source: bpAddonSource(s),
        portrait: s.portrait,
        // Only an addon row can be retried into existence. Everything else that
        // came back empty came back empty on purpose.
        onRetry: s.addonState === "failed" ? retry : undefined,
      })),
    [slots, handlers, retry],
  );

  const anyShown = railSlots.some((s) => bpGroupRenders(s.state, s.cells.length));
  const showEmpty = idle ? suggestions.length === 0 : settled && bpSearchSlotsEmpty(railSlots);

  return (
    <div className="relative flex h-full flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[var(--bp-page)]" />
      {settings.bigPictureMosaic !== false && <BpMosaic metas={mosaicPool} variant="stage" />}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: IDLE_WASH }} />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
          idle ? "opacity-0" : "opacity-100"
        }`}
        style={{ background: RESULTS_WASH }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-[clamp(11px,1.4vh,22px)] px-[var(--bp-gutter)] pt-[var(--bp-page-top)]">
        <BpSearchField
          query={query}
          onQuery={setQuery}
          typing={typing}
          onStartTyping={startTyping}
          inputRef={inputRef}
        />

        {/* Held for the whole query, not gated on chips arriving. Counts land one
            source at a time, and a strip that appears mid-search shoves the rail
            down under a ring that is already in it. */}
        {!idle && (
          <div
            data-bp-row
            style={CHIPS_SCOPE}
            className="flex min-h-[clamp(44px,4.8vh,56px)] items-center gap-[clamp(6px,0.6vw,12px)]"
          >
            <div
              data-bp-scroll-x
              className="flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-bp-focusable
                  data-bp-chip
                  aria-pressed={active === c.id}
                  onClick={() => {
                    SFX.click();
                    setChosen({ q: query, id: c.id });
                  }}
                  className={`flex h-[clamp(44px,4.8vh,56px)] shrink-0 items-center gap-[clamp(6px,0.5vw,10px)] rounded-full px-[clamp(14px,1.2vw,22px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold transition-colors duration-[var(--bp-dur-fast)] ${
                    active === c.id
                      ? "border border-transparent bg-[var(--bp-on)] text-ink"
                      : "border border-[var(--bp-edge)] text-ink-subtle"
                  }`}
                >
                  {active === c.id && (
                    <span
                      aria-hidden
                      className="h-[clamp(7px,0.9vh,12px)] w-[clamp(7px,0.9vh,12px)] shrink-0 rounded-full bg-current"
                    />
                  )}
                  {c.label}
                  <span className="text-[clamp(10.5px,1.4vh,16px)] font-bold opacity-60">{c.count}</span>
                </button>
              ))}
            </div>
            {/* Never a running total. Printing a count while addons are still
                answering and then growing more rows underneath it reads as the
                app finishing and then glitching. */}
            <span className="ms-auto shrink-0 text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              {busy ? t("Searching") : settled && total > 0 ? t("{n} results", { n: total }) : ""}
            </span>
          </div>
        )}

        {!idle && tmdbUnavailable && anyShown && (
          <p className="rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] px-[clamp(14px,1.2vw,24px)] py-[clamp(10px,1.2vh,18px)] text-[clamp(12px,1.65vh,19px)] font-medium text-ink-muted">
            {t("TMDB is temporarily unavailable, so these results may be incomplete.")}
          </p>
        )}

        {idle ? (
          <div
            data-bp-scroll-y
            className="-mx-[var(--bp-gutter)] min-h-0 flex-1 overflow-y-auto px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[10px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <BpRecentRow
              recent={recent}
              onPick={(q) => {
                setBpFocus(inputRef.current, { silent: true });
                setQuery(q);
              }}
              onClear={() => {
                setBpFocus(inputRef.current, { silent: true });
                clearRecent();
              }}
            />
            {suggestions.length > 0 && (
              <>
                <h2 className="mb-[clamp(9px,1.1vh,16px)] text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  {t("Suggested")}
                </h2>
                <div
                  data-bp-grid
                  className="grid gap-[clamp(11px,1vw,21px)] pb-[56px]"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(210px, 17vw, 330px), 1fr))" }}
                >
                  {suggestions.map((m) => (
                    <BpResultCard key={m.id} meta={m} onSelect={pick} />
                  ))}
                </div>
              </>
            )}
            {showEmpty && (
              <BpEmptyState
                message={t("Start typing to search movies, series and everything your addons carry.")}
              />
            )}
          </div>
        ) : showEmpty ? (
          <BpEmptyState
            message={bpSearchEmptyMessage({ t, trimmed: query.trim(), tmdbUnavailable, hasResults, noResults, filterStale, failedCount })}
            action={failedCount > 0 ? t("Try again") : undefined}
            onAction={failedCount > 0 ? retry : undefined}
          />
        ) : (
          <BpSearchResults slots={railSlots} resetKey={query} />
        )}
      </div>

      {!isAndroid() && (
        <BpKeyboardSheet
          open={typing}
          onChar={(c) => setQuery(query + c)}
          onBackspace={() => setQuery(query.slice(0, -1))}
          onClear={clear}
          onDone={stopTyping}
        />
      )}
    </div>
  );
}
