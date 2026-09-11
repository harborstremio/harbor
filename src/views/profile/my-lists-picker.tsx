import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp, ListVideo, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Poster } from "@/components/poster";
import { useCustomLists } from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { currentAuthor } from "@/lib/theme-auth";
import {
  MAX_FEATURED_LISTS,
  buildFeaturedPayload,
  fetchFeaturedLists,
  readLocalLists,
  saveFeaturedLists,
  toPickableList,
  type FeaturedList,
  type PickableList,
} from "@/lib/social/featured-lists";

function normName(value: string): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function matchSelection(featured: FeaturedList[], lists: PickableList[]): string[] {
  const byName = new Map<string, string>();
  for (const list of lists) {
    const key = normName(list.name);
    if (!byName.has(key)) byName.set(key, list.id);
  }
  const ids: string[] = [];
  for (const f of featured) {
    const id = byName.get(normName(f.name));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_FEATURED_LISTS);
}

function ListRow({
  list,
  selected,
  ghost,
  disabled,
  onToggle,
}: {
  list: PickableList;
  selected: boolean;
  ghost?: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-md p-2.5 text-start ring-1 transition-colors disabled:opacity-40 ${
        selected ? "bg-elevated ring-edge" : "ring-edge-soft hover:bg-elevated"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          selected ? "bg-accent text-canvas" : "ring-1 ring-edge"
        }`}
      >
        {selected && <Check size={16} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{list.name}</div>
        {list.description && (
          <div className="line-clamp-2 text-[12px] leading-snug text-ink-muted">
            {list.description}
          </div>
        )}
        <div className="text-[12px] text-ink-subtle">
          {list.items.length} {list.items.length === 1 ? t("title") : t("titles")}
          {ghost && <span> · {t("not in your library")}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {list.items.slice(0, 4).map((item) => (
          <div key={item.id} className="w-8">
            <Poster
              src={item.poster || undefined}
              seed={item.name || item.id}
              ratio="portrait"
              className="rounded-sm"
            />
          </div>
        ))}
      </div>
    </button>
  );
}

function SelectedRow({
  list,
  index,
  total,
  ghost,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  list: PickableList;
  index: number;
  total: number;
  ghost?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-elevated p-2.5 ring-1 ring-edge">
      <div className="flex shrink-0 flex-col">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={t("Move up")}
          className="flex h-6 w-7 items-center justify-center rounded-t-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-25"
        >
          <ChevronUp size={16} strokeWidth={2.5} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={t("Move down")}
          className="flex h-6 w-7 items-center justify-center rounded-b-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-25"
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>
      </div>
      <span className="w-4 shrink-0 text-center text-[13px] font-semibold tabular-nums text-ink-subtle">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{list.name}</div>
        {list.description && (
          <div className="line-clamp-2 text-[12px] leading-snug text-ink-muted">
            {list.description}
          </div>
        )}
        <div className="text-[12px] text-ink-subtle">
          {list.items.length} {list.items.length === 1 ? t("title") : t("titles")}
          {ghost && <span> · {t("not in your library")}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {list.items.slice(0, 3).map((item) => (
          <div key={item.id} className="w-8">
            <Poster
              src={item.poster || undefined}
              seed={item.name || item.id}
              ratio="portrait"
              className="rounded-sm"
            />
          </div>
        ))}
      </div>
      <button
        onClick={onRemove}
        aria-label={t("Remove from featured")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-danger"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function MyListsPicker({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const local = useCustomLists();
  const lists = useMemo(() => local.map(toPickableList), [local]);
  const [selected, setSelected] = useState<string[]>([]);
  const [served, setServed] = useState<FeaturedList[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ghosts = useMemo(() => {
    const localNames = new Set(lists.map((l) => normName(l.name)));
    return served
      .filter((s) => !localNames.has(normName(s.name)))
      .map((s) => ({
        id: "srv:" + s.id,
        name: s.name,
        description: s.description,
        items: s.items,
      }));
  }, [lists, served]);
  const entries = useMemo(() => [...lists, ...ghosts], [lists, ghosts]);
  const ghostIds = useMemo(() => new Set(ghosts.map((g) => g.id)), [ghosts]);
  const selectedEntries = useMemo(
    () =>
      selected.map((id) => entries.find((e) => e.id === id)).filter((l): l is PickableList => !!l),
    [selected, entries],
  );
  const unselectedEntries = useMemo(
    () => entries.filter((e) => !selected.includes(e.id)),
    [entries, selected],
  );

  useEffect(() => {
    const handle = currentAuthor()?.handle;
    if (!handle) return;
    const ctrl = new AbortController();
    fetchFeaturedLists(handle, ctrl.signal)
      .then((featured) => {
        setServed(featured);
        const localPick = readLocalLists();
        const localNames = new Set(localPick.map((l) => normName(l.name)));
        const matched = matchSelection(featured, localPick);
        const gIds = featured
          .filter((f) => !localNames.has(normName(f.name)))
          .map((f) => "srv:" + f.id);
        setSelected([...matched, ...gIds]);
        setLoaded(true);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_FEATURED_LISTS) return cur;
      return [...cur, id];
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setSelected((cur) => {
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    if (!loaded) return;
    setSaving(true);
    setError(null);
    try {
      const byId = new Map(entries.map((l) => [l.id, l] as const));
      const picked = selected.map((id) => byId.get(id)).filter((l): l is PickableList => !!l);
      await saveFeaturedLists(buildFeaturedPayload(picked, served), true);
      onClose?.();
    } catch {
      setError(t("Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[185] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
    >
      <button aria-label={t("Close")} className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-edge">
        <div className="flex items-center justify-between border-b border-edge-soft px-6 py-4">
          <h2 className="font-display text-[20px] text-ink">{t("Featured lists")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-elevated"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-5">
          <p className="pb-1 text-[13px] text-ink-muted">
            {t("Pick up to {max} lists to show on your public profile.", {
              max: MAX_FEATURED_LISTS,
            })}
          </p>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-edge py-12 text-center">
              <ListVideo size={24} className="text-ink-subtle" />
              <p className="mt-2 text-[14px] text-ink-muted">{t("You have no lists yet")}</p>
              <p className="mt-1 text-[12px] text-ink-subtle">
                {t("Create lists in your library to feature them here")}
              </p>
            </div>
          ) : (
            <>
              {selectedEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                    {t("Featured order")}
                  </div>
                  {selectedEntries.map((list, i) => (
                    <SelectedRow
                      key={list.id}
                      list={list}
                      index={i}
                      total={selectedEntries.length}
                      ghost={ghostIds.has(list.id)}
                      onMoveUp={() => move(list.id, -1)}
                      onMoveDown={() => move(list.id, 1)}
                      onRemove={() => toggle(list.id)}
                    />
                  ))}
                </div>
              )}
              {unselectedEntries.length > 0 && (
                <div className="space-y-2 pt-1">
                  {selectedEntries.length > 0 && (
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                      {t("Add a list")}
                    </div>
                  )}
                  {unselectedEntries.map((list) => (
                    <ListRow
                      key={list.id}
                      list={list}
                      selected={false}
                      ghost={ghostIds.has(list.id)}
                      disabled={selected.length >= MAX_FEATURED_LISTS}
                      onToggle={() => toggle(list.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 py-4">
          <span className="text-[13px] tabular-nums text-ink-subtle">
            {t("{selected}/{max} selected", { selected: selected.length, max: MAX_FEATURED_LISTS })}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted hover:bg-elevated"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={() => void save()}
              disabled={saving || !loaded}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Check size={20} /> {saving ? t("Saving") : t("Save")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
