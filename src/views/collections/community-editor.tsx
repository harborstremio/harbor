import { ArrowLeft, Check, Eye, GripVertical, ImagePlus, ListOrdered, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { ResultPoster } from "@/components/search/result-poster";
import { BackToTop } from "@/components/back-to-top";
import { searchAll } from "@/lib/search";
import { searchManga } from "@/lib/manga/api";
import type { MangaSummary } from "@/lib/manga/model";
import {
  MAX_COLLECTION_DESCRIPTION,
  MAX_COLLECTION_ITEMS,
  MAX_COLLECTION_NAME,
  MAX_COLLECTION_TAGS,
  MAX_TAG_LENGTH,
  addCollectionTag,
  clearCollectionItems,
  normalizeTag,
  readCollections,
  removeCollectionTag,
  removeFromCollection,
  renameCollection,
  reorderCollectionItems,
  setCollectionBackground,
  setCollectionCover,
  setCollectionDescription,
  setCollectionNumbered,
  toggleInCollection,
  useCollection,
  type CollectionItemType,
} from "@/lib/collections";
import {
  fileToCollectionBackground,
  fileToCollectionCover,
  publishCollections,
  removeCollectionBackground,
  removeCollectionCover,
  uploadCollectionBackground,
  uploadCollectionCover,
} from "@/lib/social/collections-sync";

type Hit = { id: string; type: CollectionItemType; name: string; poster?: string };

const TYPE_DOT: Record<CollectionItemType, string> = {
  movie: "bg-sky-400",
  series: "bg-emerald-400",
  manga: "bg-violet-400",
};

function syncSoon() {
  void publishCollections(readCollections()).catch(() => {});
}

export function CommunityCollectionEditor({
  id,
  onBack,
  onViewPage,
}: {
  id: string;
  onBack: () => void;
  onViewPage: (id: string) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const collection = useCollection(id);
  const scrollRef = useRef<HTMLElement>(null);

  const [name, setName] = useState(collection?.name ?? "");
  const [desc, setDesc] = useState(collection?.description ?? "");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | CollectionItemType>("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const clearTimerRef = useRef<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(() => collection?.items.map((it) => it.id) ?? []);

  const itemIds = collection?.items.map((it) => it.id).join(",") ?? "";
  useEffect(() => {
    if (dragId) return;
    setOrder(itemIds ? itemIds.split(",") : []);
  }, [itemIds, dragId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const [av, manga] = await Promise.all([
        searchAll(settings.tmdbKey, q).catch(() => null),
        Promise.resolve(searchManga(q)).catch(() => [] as MangaSummary[]),
      ]);
      if (!alive) return;
      const out: Hit[] = [];
      if (av) {
        for (const m of av.movies) out.push({ id: m.id, type: "movie", name: m.name, poster: m.poster });
        for (const s of av.series) out.push({ id: s.id, type: "series", name: s.name, poster: s.poster });
      }
      for (const mg of (manga ?? []).slice(0, 8)) {
        out.push({ id: mg.id, type: "manga", name: mg.title, poster: mg.cover });
      }
      const seen = new Set<string>();
      const dedup: Hit[] = [];
      for (const h of out) {
        if (seen.has(h.id)) continue;
        seen.add(h.id);
        dedup.push(h);
      }
      setHits(dedup.slice(0, 24));
      setSearching(false);
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, settings.tmdbKey]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const hitCounts = useMemo(() => {
    const c = { movie: 0, series: 0, manga: 0 };
    for (const h of hits) c[h.type]++;
    return c;
  }, [hits]);
  const filteredHits = useMemo(
    () => (typeFilter === "all" ? hits : hits.filter((h) => h.type === typeFilter)),
    [hits, typeFilter],
  );
  const orderedItems = useMemo(() => {
    const source = collection?.items ?? [];
    const byId = new Map(source.map((it) => [it.id, it] as const));
    const seq = order.length ? order : source.map((it) => it.id);
    const out = seq.map((oid) => byId.get(oid)).filter((x): x is (typeof source)[number] => !!x);
    for (const it of source) if (!out.includes(it)) out.push(it);
    return out;
  }, [collection, order]);
  const hitFilters: { id: "all" | CollectionItemType; label: string; count: number }[] = [
    { id: "all", label: t("All"), count: hits.length },
    { id: "movie", label: t("Movies"), count: hitCounts.movie },
    { id: "series", label: t("Series"), count: hitCounts.series },
    { id: "manga", label: t("Manga"), count: hitCounts.manga },
  ];

  if (!collection) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] text-ink-muted">{t("This collection is no longer here.")}</p>
        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-full border border-edge px-6 text-[14px] font-semibold text-ink transition-colors hover:border-ink-subtle"
        >
          {t("Back to collections")}
        </button>
      </main>
    );
  }

  const memberIds = new Set(collection.items.map((it) => it.id));
  const atItemMax = collection.items.length >= MAX_COLLECTION_ITEMS;
  const tags = collection.tags ?? [];
  const tagsFull = tags.length >= MAX_COLLECTION_TAGS;

  const typeLabel = (ty: CollectionItemType) =>
    ty === "movie" ? t("Movie") : ty === "series" ? t("Series") : t("Manga");

  const back = () => {
    syncSoon();
    onBack();
  };
  const viewPage = () => {
    syncSoon();
    onViewPage(id);
  };

  const toggleHit = (hit: Hit) => {
    if (!memberIds.has(hit.id) && atItemMax) return;
    toggleInCollection(id, hit);
  };

  const clearAll = () => {
    if (confirmClear) {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
      setConfirmClear(false);
      clearCollectionItems(collection.id);
      syncSoon();
      return;
    }
    setConfirmClear(true);
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => setConfirmClear(false), 2500);
  };

  const addTag = () => {
    if (!normalizeTag(tagInput)) return;
    addCollectionTag(collection.id, tagInput);
    syncSoon();
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    removeCollectionTag(collection.id, tag);
    syncSoon();
  };

  const onDragEnterItem = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setOrder((cur) => {
      const base = cur.length ? [...cur] : collection.items.map((it) => it.id);
      const from = base.indexOf(dragId);
      const to = base.indexOf(overId);
      if (from < 0 || to < 0) return cur;
      base.splice(from, 1);
      base.splice(to, 0, dragId);
      return base;
    });
  };

  const commitReorder = () => {
    if (dragId && order.length) {
      reorderCollectionItems(id, order);
      syncSoon();
    }
    setDragId(null);
  };

  const toggleNumbered = () => {
    setCollectionNumbered(id, !collection.numbered);
    syncSoon();
  };

  return (
    <main
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 pt-24 pb-24 sm:px-8 lg:px-12 lg:pt-28"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-elevated/60 ps-3.5 pe-5 text-[14px] font-semibold text-ink transition-colors hover:bg-raised"
          >
            <ArrowLeft size={17} strokeWidth={2.2} className="dir-icon" />
            {t("Collections")}
          </button>
          <button
            type="button"
            onClick={viewPage}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-edge bg-canvas/80 px-5 text-[14px] font-semibold text-ink transition-colors hover:border-ink-subtle hover:bg-canvas/95"
          >
            <Eye size={16} strokeWidth={2} />
            {t("View collection page")}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("Edit collection")}
          </span>
          <input
            value={name}
            maxLength={MAX_COLLECTION_NAME}
            onChange={(e) => {
              setName(e.target.value);
              renameCollection(id, e.target.value);
            }}
            placeholder={t("Name this collection")}
            spellCheck={false}
            className="w-full border-0 border-b border-edge-soft bg-transparent pb-2 font-display text-[34px] font-medium leading-tight tracking-tight text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink-subtle"
          />
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <ImageField
            label={t("Cover image")}
            hint={t("Shown on the card and at the top of the page.")}
            url={collection.coverImage}
            canUpload
            onUpload={async (file) => {
              const local = await fileToCollectionCover(file);
              setCollectionCover(id, local);
              await publishCollections(readCollections()).catch(() => {});
              try {
                const { url } = await uploadCollectionCover(id, file);
                if (url) setCollectionCover(id, url);
              } catch {
                throw new Error(
                  t("Saved on your device, but it couldn't be uploaded for others to see. Try again."),
                );
              }
              syncSoon();
            }}
            onRemove={async () => {
              await removeCollectionCover(id).catch(() => {});
              setCollectionCover(id, null);
              syncSoon();
            }}
          />
          <ImageField
            label={t("Page background")}
            hint={t("Fills the backdrop when someone opens the collection.")}
            url={collection.bgImage}
            canUpload
            onUpload={async (file) => {
              const local = await fileToCollectionBackground(file);
              setCollectionBackground(id, local);
              await publishCollections(readCollections()).catch(() => {});
              try {
                const { url } = await uploadCollectionBackground(id, file);
                if (url) setCollectionBackground(id, url);
              } catch {
                throw new Error(
                  t("Saved on your device, but it couldn't be uploaded for others to see. Try again."),
                );
              }
              syncSoon();
            }}
            onRemove={async () => {
              await removeCollectionBackground(id).catch(() => {});
              setCollectionBackground(id, null);
              syncSoon();
            }}
          />
        </section>

        <section className="flex flex-col gap-2">
          <label className="text-[13px] font-semibold text-ink">{t("Description")}</label>
          <textarea
            value={desc}
            maxLength={MAX_COLLECTION_DESCRIPTION}
            onChange={(e) => {
              setDesc(e.target.value);
              setCollectionDescription(id, e.target.value);
            }}
            rows={3}
            placeholder={t("What ties these together? A studio, a mood, a marathon night.")}
            className="w-full resize-none rounded-2xl border border-edge-soft bg-elevated/40 px-4 py-3 text-[14px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink-subtle"
          />
        </section>

        <section className="flex flex-col gap-2.5">
          <label className="text-[13px] font-semibold text-ink">{t("Tags")}</label>
          <p className="text-[12px] text-ink-subtle">
            {t("Add up to {max} tags so people can find this in the community.", { max: MAX_COLLECTION_TAGS })}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-raised px-3 py-1 text-[12px] text-ink"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={t("Remove tag")}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-ink-subtle transition-colors hover:text-danger"
                  >
                    <X size={12} strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {tagsFull ? (
            <p className="text-[12px] text-ink-subtle">{t("Tag limit reached")}</p>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <input
                value={tagInput}
                maxLength={MAX_TAG_LENGTH}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={t("Add a tag")}
                spellCheck={false}
                className="h-11 w-full max-w-xs rounded-full border border-edge-soft bg-elevated/50 px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink-subtle"
              />
              <button
                type="button"
                onClick={addTag}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-edge bg-canvas/80 px-4 text-[14px] font-semibold text-ink transition-colors hover:border-ink-subtle hover:bg-canvas/95"
              >
                <Plus size={16} strokeWidth={2} />
                {t("Add")}
              </button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[16px] font-semibold text-ink">{t("Titles")}</h2>
            <div className="flex items-baseline gap-3">
              {collection.items.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className={`text-[12px] font-medium transition-colors ${
                    confirmClear ? "text-danger" : "text-ink-subtle hover:text-danger"
                  }`}
                >
                  {confirmClear ? t("Tap again to clear") : t("Clear all")}
                </button>
              )}
              <span className="text-[12px] tabular-nums text-ink-muted">
                {t("{n} / {max} titles", { n: collection.items.length, max: MAX_COLLECTION_ITEMS })}
              </span>
            </div>
          </div>

          {collection.items.length > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={!!collection.numbered}
              onClick={toggleNumbered}
              className="flex items-center justify-between gap-3 rounded-2xl border border-edge-soft bg-elevated/40 px-4 py-3 text-start transition-colors hover:border-edge"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <ListOrdered size={18} strokeWidth={2} className="shrink-0 text-ink-muted" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">
                    {t("Number the titles")}
                  </span>
                  <span className="block text-[12px] leading-snug text-ink-subtle">
                    {t("Show rank numbers on the cards. Drag the titles below to set the order.")}
                  </span>
                </span>
              </span>
              <span
                aria-hidden
                className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  collection.numbered ? "bg-accent" : "bg-edge"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    collection.numbered ? "translate-x-4" : ""
                  }`}
                />
              </span>
            </button>
          )}

          <div className="relative w-full max-w-xl">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search movies, shows, and manga to add")}
              spellCheck={false}
              className="h-12 w-full rounded-full border border-edge bg-elevated/50 ps-11 pe-10 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink-subtle"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("Clear search")}
                className="absolute end-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            )}
          </div>

          {searching && hits.length === 0 && (
            <p className="text-[13px] text-ink-subtle">{t("Searching...")}</p>
          )}

          {hits.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {hitFilters.map((f) => {
                  if (f.id !== "all" && f.count === 0) return null;
                  const on = typeFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTypeFilter(f.id)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                        on
                          ? "border-transparent bg-ink text-canvas"
                          : "border-edge-soft bg-elevated/40 text-ink-muted hover:border-edge hover:text-ink"
                      }`}
                    >
                      {f.id !== "all" && (
                        <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[f.id]}`} />
                      )}
                      {f.label}
                      <span className={`tabular-nums ${on ? "text-canvas/70" : "text-ink-subtle"}`}>
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))" }}
              >
                {filteredHits.map((hit) => {
                  const inSet = memberIds.has(hit.id);
                  return (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => toggleHit(hit)}
                      disabled={!inSet && atItemMax}
                      title={`${hit.name}  ·  ${typeLabel(hit.type)}`}
                      className="group/hit flex flex-col gap-1.5 text-start disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="relative transition-transform duration-200 ease-out group-hover/hit:-translate-y-0.5">
                        <ResultPoster
                          id={hit.id}
                          poster={hit.poster}
                          className={`ring-2 transition-all duration-200 ${inSet ? "ring-accent" : "ring-transparent group-hover/hit:ring-edge"}`}
                        />
                        <span className="pointer-events-none absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 py-0.5 ps-1.5 pe-2 text-[10px] font-semibold text-white/90 backdrop-blur-md">
                          <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[hit.type]}`} />
                          {typeLabel(hit.type)}
                        </span>
                        <span
                          className={`absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                            inSet
                              ? "bg-accent text-white"
                              : "bg-black/45 text-white/80 group-hover/hit:bg-black/65"
                          }`}
                        >
                          {inSet ? (
                            <Check size={14} strokeWidth={2.6} />
                          ) : (
                            <Plus size={14} strokeWidth={2.6} />
                          )}
                        </span>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[var(--poster-radius,12px)] bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 pt-7 opacity-0 transition-opacity duration-200 group-hover/hit:opacity-100">
                          <p className="line-clamp-2 text-[11px] font-medium leading-tight text-white">
                            {hit.name}
                          </p>
                        </div>
                      </div>
                      <span className="line-clamp-1 text-[12px] text-ink-muted">{hit.name}</span>
                    </button>
                  );
                })}
              </div>

              {filteredHits.length === 0 && (
                <p className="text-[13px] text-ink-subtle">{t("Nothing here for that filter.")}</p>
              )}
            </>
          )}

          {collection.items.length > 0 && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("In this collection")}
                </p>
                {orderedItems.length > 1 && (
                  <p className="text-[11.5px] text-ink-subtle">{t("Drag to reorder")}</p>
                )}
              </div>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))" }}
              >
                {orderedItems.map((item, i) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnter={() => onDragEnterItem(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={commitReorder}
                    onDrop={commitReorder}
                    className={`group/item flex cursor-grab flex-col gap-1.5 active:cursor-grabbing ${
                      dragId === item.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="relative">
                      <ResultPoster id={item.id} poster={item.poster} />
                      {collection.numbered ? (
                        <span className="pointer-events-none absolute start-1.5 top-1.5 flex min-w-[1.4rem] items-center justify-center rounded-full bg-black/70 px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums text-white backdrop-blur-md">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="pointer-events-none absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 py-0.5 ps-1.5 pe-2 text-[10px] font-semibold text-white/90 backdrop-blur-md">
                          <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[item.type]}`} />
                          {typeLabel(item.type)}
                        </span>
                      )}
                      <span className="pointer-events-none absolute bottom-1.5 start-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white/70 opacity-0 backdrop-blur-md transition-opacity group-hover/item:opacity-100">
                        <GripVertical size={13} strokeWidth={2} />
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCollection(id, item.id)}
                        title={t("Remove")}
                        aria-label={t("Remove")}
                        className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/85 opacity-0 backdrop-blur-md transition-opacity hover:bg-danger hover:text-white group-hover/item:opacity-100"
                      >
                        <X size={13} strokeWidth={2.4} />
                      </button>
                    </div>
                    <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                      {collection.numbered && (
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[item.type]}`} />
                      )}
                      <span className="line-clamp-1">{item.name}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function ImageField({
  label,
  hint,
  url,
  canUpload,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string;
  url?: string;
  canUpload: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not upload image."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {url && (
          <button
            type="button"
            onClick={() => void run(onRemove)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-danger"
          >
            <Trash2 size={13} strokeWidth={2} />
            {t("Remove")}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => canUpload && inputRef.current?.click()}
        disabled={!canUpload || busy}
        className={`group/img relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border text-center transition-colors ${
          url
            ? "border-edge-soft"
            : "border-dashed border-edge bg-elevated/40 hover:border-ink-subtle"
        } ${!canUpload ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {url ? (
          <>
            <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
            {canUpload && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[13px] font-semibold text-white opacity-0 transition-all duration-200 group-hover/img:bg-black/45 group-hover/img:opacity-100">
                <ImagePlus size={16} strokeWidth={2} className="me-2" />
                {t("Change")}
              </span>
            )}
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-6 text-ink-muted">
            <ImagePlus size={26} strokeWidth={1.6} />
            <span className="text-[13.5px] font-medium">{t("Add {label}", { label: label.toLowerCase() })}</span>
            <span className="text-[12px] text-ink-subtle">{hint}</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-canvas/60 backdrop-blur-sm">
            <Loader2 size={22} strokeWidth={2} className="animate-spin text-ink" />
          </span>
        )}
      </button>
      {!canUpload && (
        <p className="text-[12px] text-ink-subtle">{t("Sign in to upload a custom image.")}</p>
      )}
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(() => onUpload(file));
        }}
      />
    </div>
  );
}
