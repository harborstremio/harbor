import { Check, ChevronDown, Globe, Layers, Settings, Star } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useEscape } from "@/components/modal-shell";
import { mangaTags, type MangaTag } from "@/lib/manga/api";
import {
  activeMangaSource,
  activeMangaSourceId,
  listMangaSources,
  setActiveMangaSource,
  sourceIconUrl,
  subscribeMangaSources,
  type MangaSource,
} from "@/lib/manga/sources";
import { subscribeSuwayomiSourcesChanged } from "@/lib/manga/sources/suwayomi/source-events";
import { subscribeMangaLibraryChanged } from "@/lib/manga/library-events";
import { subscribeMangaLangFilter } from "@/lib/manga/lang-filter";

export const FAVORITES = "__favorites__";

export const TRIGGER =
  "flex items-center gap-2 rounded-lg border border-edge-soft bg-elevated/40 px-3 py-2 text-[13px] text-ink transition-colors hover:bg-elevated/70";

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

export function SourceDropdown() {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<MangaSource[]>(() => listMangaSources());
  const [activeId, setActiveIdState] = useState(() => activeMangaSourceId());
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(
    () =>
      subscribeMangaSources(() => {
        setSources(listMangaSources());
        setActiveIdState(activeMangaSourceId());
      }),
    [],
  );

  const active = sources.find((s) => s.id === activeId) ?? activeMangaSource();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={TRIGGER}>
        {active.id !== "all" && sourceIconUrl(active) ? (
          <img
            src={sourceIconUrl(active)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-[15px] w-[15px] shrink-0 rounded-[3px] object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <Globe size={15} className="text-ink-subtle" />
        )}
        <span className="max-w-[140px] truncate font-medium">{active.name}</span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 min-w-[220px] overflow-hidden rounded-lg border border-edge-soft bg-raised py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveMangaSource(s.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[13px] text-ink hover:bg-elevated/60"
            >
              <span className="flex min-w-0 items-center gap-2">
                {sourceIconUrl(s) ? (
                  <img
                    src={sourceIconUrl(s)}
                    alt=""
                    loading="lazy"
                    className="h-4 w-4 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <Globe size={14} className="shrink-0 text-ink-subtle" />
                )}
                <span className="truncate">{s.name}</span>
              </span>
              {s.id === active.id && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ManageServersButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Manage Servers")}
      title={t("Manage Servers")}
      className={className ? `${TRIGGER} ${className}` : TRIGGER}
    >
      <Settings size={20} className="text-ink" />
    </button>
  );
}

export function TagDropdown({
  tagId,
  onSelect,
  onOpenLibrary,
}: {
  tagId: string;
  onSelect: (id: string) => void;
  onOpenLibrary?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<MangaTag[]>([]);
  const [filter, setFilter] = useState("");
  const ref = useOutsideClose(open, () => setOpen(false));
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(240, window.innerWidth - 16);
      setMenuLeft(Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)) - bounds.left);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, ref]);
  useEscape(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, open);

  useEffect(() => {
    let alive = true;
    let request = 0;
    const load = (opts?: { clear?: boolean }) => {
      const id = ++request;
      if (opts?.clear && alive) setTags([]);
      mangaTags()
        .then((list) => {
          if (alive && id === request) setTags(list);
        })
        .catch((err) => {
          console.warn("[manga] filter list refresh failed", err);
        });
    };
    load();
    const unsubMangaSources = subscribeMangaSources(() => load({ clear: true }));
    const unsubSources = subscribeSuwayomiSourcesChanged(() => load());
    const unsubLibrary = subscribeMangaLibraryChanged(() => load());
    const unsubLang = subscribeMangaLangFilter(() => load({ clear: true }));
    return () => {
      alive = false;
      unsubMangaSources();
      unsubSources();
      unsubLibrary();
      unsubLang();
    };
  }, []);

  const active = tags.find((t) => t.id === tagId);
  const allLabel = "All Extensions";
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, filter]);
  const categories = shown.filter((tag) => tag.group === "Categories");
  const sources = shown.filter((tag) => tag.group !== "Categories")
    .sort((a, b) => a.name.localeCompare(b.name));
  const renderTag = (tag: MangaTag) => (
    <TagRow key={tag.id} label={tag.name} active={tag.id === tagId}
      onClick={() => (onSelect(tag.id), setOpen(false))} />
  );

  return (
    <div ref={ref} className="relative">
      <button ref={triggerRef} type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={TRIGGER}>
        <Layers size={15} className="text-ink-subtle" />
        <span className="max-w-[140px] truncate font-medium">
          {tagId === FAVORITES ? t("Library") : active ? active.name : t(allLabel)}
        </span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>
      {open && (
        <div style={{ left: menuLeft }} className="absolute z-30 mt-1.5 w-[240px] max-w-[calc(100vw-16px)] overflow-hidden rounded-lg border border-edge-soft bg-raised shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
          <div className="border-b border-edge-soft/60 p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("Filter tags...")}
              aria-label={t("Filter tags...")}
              className="w-full rounded-md bg-elevated/50 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-subtle outline-none focus:ring-1 focus:ring-edge"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (onOpenLibrary) onOpenLibrary();
                else onSelect(FAVORITES);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start text-[13px] text-ink hover:bg-elevated/60"
            >
              <span className="flex items-center gap-2">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {t("Library")}
              </span>
              {tagId === FAVORITES && <Check size={14} className="text-accent" />}
            </button>
            <div className="my-1 border-t border-edge-soft/60" />
            {categories.length > 0 && <>
              <div className="px-3 py-1.5 text-[11px] font-medium text-ink-subtle">{t("Categories")}</div>
              {categories.map(renderTag)}
              <div className="my-1 border-t border-edge-soft/60" />
            </>}
            <div className="px-3 py-1.5 text-[11px] font-medium text-ink-subtle">{t("Extensions")}</div>
            <TagRow
              label={t(allLabel)}
              active={!tagId}
              onClick={() => (onSelect(""), setOpen(false))}
            />
            {sources.map(renderTag)}
          </div>
        </div>
      )}
    </div>
  );
}

function TagRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start text-[13px] text-ink hover:bg-elevated/60"
    >
      <span className="truncate">{label}</span>
      {active && <Check size={14} className="text-accent" />}
    </button>
  );
}
