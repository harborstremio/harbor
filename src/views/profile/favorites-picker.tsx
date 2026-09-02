import { createPortal } from "react-dom";
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronUp, Gamepad2, KeyRound, Loader2, Music2, RotateCw, SearchX, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { currentAuthor } from "@/lib/theme-auth";
import { Avatar } from "./profile-bits";
import {
  FAVORITE_DISPLAY_CAP,
  useFavoriteCopy,
  useFavorites,
  useFavoriteSearch,
  type FavoriteKind,
  type FavoriteLists,
  type FavoriteMedia,
} from "./use-favorites";
import type { ProfileSummary } from "./profile-types";

function KindIcon({ kind, size }: { kind: FavoriteKind; size: number }) {
  const Icon = kind === "game" ? Gamepad2 : kind === "book" ? BookOpen : Music2;
  return <Icon size={size} className="text-ink-subtle" />;
}

function Cover({
  entry,
  kind,
  variant,
}: {
  entry: FavoriteMedia;
  kind: FavoriteKind;
  variant: "tile" | "row";
}) {
  const tile = variant === "tile";
  if (kind === "music") {
    const avatar = (
      <Avatar src={entry.image || undefined} size={tile ? 88 : 40} alias={entry.name} />
    );
    return tile ? <span className="flex justify-center py-1">{avatar}</span> : avatar;
  }
  const poster = (
    <Poster
      src={entry.image || undefined}
      fallbacks={entry.imageFallback ? [entry.imageFallback] : undefined}
      seed={entry.name || entry.id || "favorite"}
      ratio="portrait"
      className={tile ? "rounded-md ring-1 ring-edge-soft" : "rounded-sm"}
      lazy={tile}
    />
  );
  return tile ? poster : <div className="w-9 shrink-0">{poster}</div>;
}

function ResultTile({
  entry,
  kind,
  order,
  disabled,
  onToggle,
}: {
  entry: FavoriteMedia;
  kind: FavoriteKind;
  order: number;
  disabled: boolean;
  onToggle: () => void;
}) {
  const selected = order > 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative flex flex-col gap-2 rounded-lg p-2 text-start ring-1 transition-colors disabled:opacity-40 ${
        selected ? "bg-elevated ring-edge" : "ring-edge-soft hover:bg-elevated"
      }`}
    >
      <Cover entry={entry} kind={kind} variant="tile" />
      {selected && (
        <span className="absolute end-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold tabular-nums text-canvas">
          {order}
        </span>
      )}
      <span className="min-w-0">
        <span className="line-clamp-2 text-[12.5px] font-medium leading-tight text-ink">
          {entry.name}
        </span>
        {entry.sub && (
          <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">{entry.sub}</span>
        )}
      </span>
    </button>
  );
}

function SelectedRow({
  entry,
  kind,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  entry: FavoriteMedia;
  kind: FavoriteKind;
  index: number;
  total: number;
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
      <Cover entry={entry} kind={kind} variant="row" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{entry.name}</div>
        {entry.sub && <div className="truncate text-[12px] text-ink-subtle">{entry.sub}</div>}
      </div>
      <button
        onClick={onRemove}
        aria-label={t("Remove")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-danger"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function PickerState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-edge px-6 py-12 text-center">
      {icon}
      <p className="mt-2 text-[14px] text-ink-muted">{title}</p>
      {body && <p className="mt-1 text-[12px] text-ink-subtle">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function StateAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-elevated px-4 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}

export function FavoritesPicker({
  kind,
  initial,
  onClose,
  onSaved,
  onOpenSettings,
}: {
  kind: FavoriteKind;
  initial?: FavoriteLists | null;
  onClose: () => void;
  onSaved?: (summary: ProfileSummary) => void;
  onOpenSettings?: () => void;
}) {
  const t = useT();
  const copy = useFavoriteCopy(kind);
  const handle = currentAuthor()?.handle ?? "";
  const { entries, loaded, loadFailed, saving, save, reload } = useFavorites(handle, initial);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FavoriteMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const search = useFavoriteSearch(kind, query);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || !loaded || loadFailed) return;
    seeded.current = true;
    setSelected(entries[kind]);
  }, [loaded, loadFailed, entries, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const orderById = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((e, i) => map.set(e.id, i + 1));
    return map;
  }, [selected]);
  const atCap = selected.length >= FAVORITE_DISPLAY_CAP;

  const toggle = (entry: FavoriteMedia) => {
    setSelected((cur) => {
      if (cur.some((e) => e.id === entry.id)) return cur.filter((e) => e.id !== entry.id);
      if (cur.length >= FAVORITE_DISPLAY_CAP) return cur;
      return [...cur, entry];
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setSelected((cur) => {
      const i = cur.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const submit = async () => {
    if (!loaded || loadFailed) return;
    setError(null);
    const summary = await save(kind, selected);
    if (!summary) {
      setError(t("Could not save. Try again."));
      return;
    }
    onSaved?.(summary);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[185] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
    >
      <button aria-label={t("Close")} className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-edge">
        <div className="flex items-center justify-between border-b border-edge-soft px-6 py-4">
          <h2 className="font-display text-[20px] text-ink">{copy.title}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-elevated"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {loadFailed ? (
            <PickerState
              icon={<AlertTriangle size={24} className="text-ink-subtle" />}
              title={t("We couldn't load your saved favourites")}
              body={t("Saving now could overwrite them. Try again in a moment.")}
              action={
                <StateAction onClick={reload}>
                  <RotateCw size={15} strokeWidth={2.2} /> {t("Retry")}
                </StateAction>
              }
            />
          ) : (
            <>
              <p className="text-[13px] text-ink-muted">{copy.hint}</p>

              {selected.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                    {t("Shown order")}
                  </div>
                  {selected.map((entry, i) => (
                    <SelectedRow
                      key={entry.id}
                      entry={entry}
                      kind={kind}
                      index={i}
                      total={selected.length}
                      onMoveUp={() => move(entry.id, -1)}
                      onMoveDown={() => move(entry.id, 1)}
                      onRemove={() => toggle(entry)}
                    />
                  ))}
                </div>
              )}

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-ink-subtle"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.placeholder}
                  spellCheck={false}
                  className="h-11 w-full rounded-xl border border-edge bg-canvas ps-10 pe-10 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
                />
                {search.status === "searching" && (
                  <Loader2
                    size={16}
                    className="absolute inset-y-0 end-3.5 my-auto animate-spin text-ink-subtle"
                  />
                )}
              </div>

              {atCap && <p className="text-[12px] text-ink-subtle">{copy.atCap}</p>}

              {search.status === "idle" && (
                <PickerState
                  icon={<KindIcon kind={kind} size={24} />}
                  title={copy.idle}
                  body={copy.idleBody}
                />
              )}
              {search.status === "searching" && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-ink-subtle" />
                </div>
              )}
              {search.status === "empty" && (
                <PickerState
                  icon={<SearchX size={24} className="text-ink-subtle" />}
                  title={copy.noResults}
                  body={t("Check the spelling or try a shorter search.")}
                />
              )}
              {search.status === "failed" && (
                <PickerState
                  icon={<AlertTriangle size={24} className="text-ink-subtle" />}
                  title={copy.failed}
                  body={t("Something went wrong on the way there.")}
                  action={
                    <StateAction onClick={search.retry}>
                      <RotateCw size={15} strokeWidth={2.2} /> {t("Retry")}
                    </StateAction>
                  }
                />
              )}
              {search.status === "needs-key" && (
                <PickerState
                  icon={<KeyRound size={24} className="text-ink-subtle" />}
                  title={t("An API key is needed")}
                  body={copy.needsKey}
                  action={
                    onOpenSettings ? (
                      <StateAction onClick={onOpenSettings}>{t("Open settings")}</StateAction>
                    ) : undefined
                  }
                />
              )}
              {search.status === "ok" && (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {search.items.map((entry) => (
                    <ResultTile
                      key={entry.id}
                      entry={entry}
                      kind={kind}
                      order={orderById.get(entry.id) ?? 0}
                      disabled={!orderById.has(entry.id) && atCap}
                      onToggle={() => toggle(entry)}
                    />
                  ))}
                </div>
              )}

              {error && <p className="text-[13px] text-danger">{error}</p>}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 py-4">
          <span className="text-[13px] tabular-nums text-ink-subtle">
            {t("{selected}/{max} selected", {
              selected: selected.length,
              max: FAVORITE_DISPLAY_CAP,
            })}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted hover:bg-elevated"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={() => void submit()}
              disabled={saving || !loaded || loadFailed}
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
