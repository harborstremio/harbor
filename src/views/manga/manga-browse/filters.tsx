import { Check, ChevronDown, Globe, Layers, SlidersHorizontal, Star, Tag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
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

export const FAVORITES = "__favorites__";

const TRIGGER =
  "flex items-center gap-2 rounded-lg border border-edge-soft bg-elevated/40 px-3 py-2 text-[13px] text-ink transition-colors hover:bg-elevated/70";

function useOutsideClose(open: boolean, close: () => void) {
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

export function SourceDropdown({ onManageSources }: { onManageSources: () => void }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<MangaSource[]>(() => listMangaSources());
  const [activeId, setActiveIdState] = useState(() => activeMangaSourceId());
  const ref = useOutsideClose(open, () => setOpen(false));
  const t = useT();

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
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onManageSources();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] font-medium text-ink hover:bg-elevated/60"
          >
            <SlidersHorizontal size={14} className="text-ink-subtle" />
            {t("Manage sources")}
          </button>
          <div className="my-1 border-t border-edge-soft/60" />
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

export function TagDropdown({
  tagId,
  onSelect,
}: {
  tagId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<MangaTag[]>([]);
  const [filter, setFilter] = useState("");
  const ref = useOutsideClose(open, () => setOpen(false));
  const t = useT();

  useEffect(() => {
    let alive = true;
    const load = () => {
      mangaTags()
        .then((list) => {
          if (alive) setTags(list);
        })
        .catch(() => {});
    };
    load();
    const unsubSources = subscribeSuwayomiSourcesChanged(load);
    const unsubLibrary = subscribeMangaLibraryChanged(load);
    return () => {
      alive = false;
      unsubSources();
      unsubLibrary();
    };
  }, []);

  const active = tags.find((t) => t.id === tagId);
  const sourceMode = tags.length > 0 && tags.every((tg) => tg.group === "Sources");
  const allLabel = sourceMode ? "All sources" : "Categories";
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [tags, filter]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={TRIGGER}>
        {sourceMode ? (
          <Layers size={15} className="text-ink-subtle" />
        ) : (
          <Tag size={15} className="text-ink-subtle" />
        )}
        <span className="max-w-[140px] truncate font-medium">
          {tagId === FAVORITES ? t("Favorites") : active ? active.name : t(allLabel)}
        </span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-[240px] overflow-hidden rounded-lg border border-edge-soft bg-raised shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
          <div className="border-b border-edge-soft/60 p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t(sourceMode ? "Filter sources..." : "Filter tags...")}
              className="w-full rounded-md bg-elevated/50 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-subtle outline-none focus:ring-1 focus:ring-edge"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => (onSelect(FAVORITES), setOpen(false))}
              className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start text-[13px] text-ink hover:bg-elevated/60"
            >
              <span className="flex items-center gap-2">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {t("Favorites")}
              </span>
              {tagId === FAVORITES && <Check size={14} className="text-accent" />}
            </button>
            <div className="my-1 border-t border-edge-soft/60" />
            <TagRow
              label={t(allLabel)}
              active={!tagId}
              onClick={() => (onSelect(""), setOpen(false))}
            />
            {shown.map((t) => (
              <TagRow
                key={t.id}
                label={t.name}
                active={t.id === tagId}
                onClick={() => (onSelect(t.id), setOpen(false))}
              />
            ))}
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
