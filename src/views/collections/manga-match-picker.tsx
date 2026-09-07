import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { CoverImg } from "@/components/cover-img";
import { searchMangaEverywhereExhaustive } from "@/lib/manga/api";
import { activeMangaProvider, activeMangaSource, hasAnyMangaSource } from "@/lib/manga/sources";
import type { MangaSummary } from "@/lib/manga/model";
import type { MangaTag } from "@/lib/manga/types";

// Hit ids embed their extension: `sourceId~mangaId` on a single server,
// `serverId::sourceId~mangaId` in All-Sources mode. Group by extension so the
// user picks which extension's copy to read.
function extensionKeyFor(id: string): string {
  const afterAgg = id.includes("::") ? id.slice(id.indexOf("::") + 2) : id;
  const tilde = afterAgg.indexOf("~");
  if (tilde === -1) return "";
  const server = id.includes("::") ? id.slice(0, id.indexOf("::")) : "";
  return `${server}::${afterAgg.slice(0, tilde)}`;
}

function extensionLabelFor(key: string, tags: Map<string, string>, fallback: string): string {
  if (!key) return fallback;
  const ext = key.includes("::") ? key.slice(key.indexOf("::") + 2) : key;
  return tags.get(ext) ?? ext;
}

export function MangaMatchPicker({
  name,
  onSelect,
  onClose,
}: {
  name: string;
  onSelect: (mangaId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const hasSource = useMemo(() => hasAnyMangaSource(), []);
  const [query, setQuery] = useState(name);
  const [debounced, setDebounced] = useState(name);
  const [hits, setHits] = useState<MangaSummary[] | null>(null);
  const [tagNames, setTagNames] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const fallbackSourceName = useMemo(() => activeMangaSource().name, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2 || !hasSource) {
      setHits([]);
      setBusy(false);
      return;
    }
    let alive = true;
    setBusy(true);
    (async () => {
      const tags = await (activeMangaProvider().tags?.().catch(() => [] as MangaTag[]) ??
        Promise.resolve([] as MangaTag[]));
      let res = await searchMangaEverywhereExhaustive(q).catch(() => [] as MangaSummary[]);
      // Some extensions match nothing on queries with a colon ("Tokyo Ghoul:re")
      // while answering the pre-colon prefix fine, so retry once with it.
      if (res.length === 0) {
        const cut = q.split(":")[0].trim();
        if (cut.length >= 2 && cut.toLowerCase() !== q.toLowerCase()) {
          res = await searchMangaEverywhereExhaustive(cut).catch(() => [] as MangaSummary[]);
        }
      }
      return { res, tags };
    })().then(({ res, tags }) => {
      if (!alive) return;
      setHits(res.slice(0, 24));
      setTagNames(new Map(tags.map((tg) => [tg.id, tg.name])));
      setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, [debounced, hasSource]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("Close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-2xl border border-edge bg-elevated p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold text-ink">{t("Find on your sources")}</p>
            <p className="text-[12.5px] text-ink-muted">{name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <label className="flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-canvas/60 px-4 focus-within:border-ink-subtle">
          <Search size={16} className="shrink-0 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search your manga sources")}
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
          />
        </label>
        <div className="min-h-[120px] flex-1 overflow-y-auto">
          {!hasSource ? (
            <p className="px-1 py-6 text-center text-[13.5px] leading-relaxed text-ink-muted">
              {t("Add a manga source first — a Suwayomi server, Mangayomi, a local folder, or a plugin — then pick the matching copy here.")}
            </p>
          ) : busy && hits === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13.5px] text-ink-muted">
              <Loader2 size={16} className="animate-spin" />
              {t("Searching your sources…")}
            </div>
          ) : !hits?.length ? (
            <p className="px-1 py-6 text-center text-[13.5px] leading-relaxed text-ink-muted">
              {t("No match on your extensions. Edit the query above or check the language filter in the manga tab.")}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {(() => {
                const groups = new Map<string, MangaSummary[]>();
                for (const h of hits ?? []) {
                  const key = extensionKeyFor(h.id);
                  const list = groups.get(key) ?? [];
                  list.push(h);
                  groups.set(key, list);
                }
                return [...groups.entries()].map(([key, items]) => (
                  <section key={key || "other"}>
                    <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                      {extensionLabelFor(key, tagNames, fallbackSourceName)}
                    </p>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {items.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(h.id)}
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition-colors hover:bg-raised"
                          >
                            {h.cover ? (
                              <CoverImg
                                src={h.cover}
                                alt=""
                                draggable={false}
                                className="h-14 w-10 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <span className="h-14 w-10 shrink-0 rounded-md bg-raised" />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-semibold text-ink">
                                {h.title}
                              </span>
                              {h.author && (
                                <span className="block truncate text-[12px] text-ink-muted">
                                  {h.author}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
