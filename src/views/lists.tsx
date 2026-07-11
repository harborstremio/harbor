import { BackToTop } from "@/components/back-to-top";
import { HarborLoader } from "@/components/harbor-loader";
import { PickCard } from "@/components/pick-card";
import { useT } from "@/lib/i18n";
import { ListResolveError, sourceLabel, type ListSource } from "@/lib/lists/types";
import { useScrollMemory, useView } from "@/lib/view";
import { RefreshCw } from "lucide-react";
import { useMemo, useRef } from "react";

import { ListsEmptyState } from "./lists/empty-state";
import { ListPicker } from "./lists/list-picker";
import { useCustomLists } from "./lists/use-custom-lists";
import { useListItems } from "./lists/use-list-items";

const RENDER_CAP = 500;

export default function ListsView({ active }: { active: boolean }) {
  const t = useT();
  const { openSettings } = useView();
  const { lists, activeId, selectId, addList, editList, removeList } = useCustomLists();

  const activeList = useMemo(() => lists.find((l) => l.id === activeId) ?? null, [lists, activeId]);
  const { items, loading, error, refresh } = useListItems(active ? activeList : null, active);

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory("lists", scrollRef, active);

  const count = activeList && !loading && !error ? items.length : null;

  return (
    <main data-rail-flush className="relative flex min-h-0 flex-1 flex-col pt-20">
      <header className="relative z-[40] flex shrink-0 flex-wrap items-center gap-2.5 border-b border-edge-soft/40 bg-surface px-6 py-2.5">
        <ListPicker
          lists={lists}
          activeId={activeId}
          count={count}
          onSelect={selectId}
          onAdd={addList}
          onEdit={editList}
          onRemove={removeList}
        />
        <button
          onClick={refresh}
          disabled={loading || !activeList}
          title={t("Refresh list")}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-edge-soft/55 bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
        >
          <RefreshCw size={15} strokeWidth={2} className={loading ? "animate-spin" : ""} />
        </button>
        {count != null && (
          <span className="ms-auto rounded-full bg-canvas/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">
            {t("{n} titles", { n: count.toLocaleString() })}
          </span>
        )}
      </header>

      {lists.length === 0 ? (
        <ListsEmptyState onAdd={addList} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-16">
          {!activeList ? (
            <Notice text={t("Pick a list to view it.")} />
          ) : error ? (
            <Notice
              text={errorText(error, t)}
              onRetry={refresh}
              onSettings={hasKeyError(error) ? () => openSettings() : undefined}
            />
          ) : loading && items.length === 0 ? (
            <div className="flex justify-center py-16">
              <HarborLoader size="sm" />
            </div>
          ) : items.length === 0 ? (
            <Notice text={t("This list is empty, or its items couldn't be matched.")} />
          ) : (
            <>
              <div className="mb-7 flex items-baseline gap-3">
                <h1 className="font-display text-[30px] font-medium leading-none tracking-tight text-ink">
                  {activeList.name}
                </h1>
                <span className="text-[13px] text-ink-subtle">
                  {t("{n} titles", { n: items.length.toLocaleString() })} · {sourceLabel(activeList.source)}
                </span>
              </div>
              {items.length > RENDER_CAP && (
                <p className="mb-4 text-[12.5px] text-ink-subtle">
                  {t("Showing {shown} of {total}.", {
                    shown: RENDER_CAP.toLocaleString(),
                    total: items.length.toLocaleString(),
                  })}
                </p>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-8">
                {items.slice(0, RENDER_CAP).map((m, i) => (
                  <PickCard key={`${m.id}-${i}`} meta={m} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function keyLabel(source: ListSource): string {
  return source === "mdblist" ? "MDBList" : "TMDB";
}

function hasKeyError(error: ListResolveError): boolean {
  return error.reason === "missing-key";
}

function errorText(
  error: ListResolveError,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  switch (error.reason) {
    case "missing-key":
      return t("This list needs your {key} API key. Add it in Settings, then refresh.", {
        key: keyLabel(error.source),
      });
    case "not-found":
      return t("That list is private or doesn't exist. Public lists only.");
    default:
      return t("Couldn't load this list. Check the URL and try again.");
  }
}

function Notice({ text, onRetry, onSettings }: { text: string; onRetry?: () => void; onSettings?: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-edge px-6 py-16 text-center">
      <p className="max-w-[520px] text-[14.5px] leading-relaxed text-ink-muted">{text}</p>
      <div className="flex items-center gap-2">
        {onSettings && (
          <button
            onClick={onSettings}
            className="h-9 rounded-lg px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {t("Open Settings")}
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="h-9 rounded-lg bg-elevated px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-raised"
          >
            {t("Retry")}
          </button>
        )}
      </div>
    </div>
  );
}
