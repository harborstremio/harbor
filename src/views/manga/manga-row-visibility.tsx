import { Plus } from "lucide-react";
import { useEffect, useReducer } from "react";
import { useT } from "@/lib/i18n";

const KEY = "harbor.manga.hiddenRows";

export const MANGA_HIDEABLE_ROWS: Array<{ key: string; label: string }> = [
  { key: "anilist", label: "Your AniList" },
  { key: "because-you-watched", label: "Because you watched" },
  { key: "popular", label: "Popular Manga" },
];

let hidden = load();
const listeners = new Set<() => void>();

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...hidden]));
  } catch {
    void 0;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function hideMangaRow(key: string) {
  if (hidden.has(key)) return;
  hidden = new Set(hidden);
  hidden.add(key);
  persist();
  emit();
}

export function showMangaRow(key: string) {
  if (!hidden.has(key)) return;
  hidden = new Set(hidden);
  hidden.delete(key);
  persist();
  emit();
}

export function useMangaHiddenRows(): Set<string> {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return hidden;
}

export function MangaHiddenRows() {
  const hiddenSet = useMangaHiddenRows();
  const t = useT();
  const items = MANGA_HIDEABLE_ROWS.filter((r) => hiddenSet.has(r.key));
  if (items.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] font-medium text-ink-subtle">{t("Hidden sections")}</span>
      {items.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => showMangaRow(r.key)}
          className="inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-elevated/40 px-3 py-1 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink active:scale-95 motion-reduce:active:scale-100"
        >
          <Plus size={13} strokeWidth={2.4} />
          {t(r.label)}
        </button>
      ))}
    </div>
  );
}
