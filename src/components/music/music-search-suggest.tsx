import { useEffect, useMemo, useRef, useState } from "react";
import { Disc3, Mic2, Music2 } from "@/components/icons/music-icons";
import { searchTyped } from "@/lib/music/catalog";
import { artistIdentityKey, peekArtistIdentity, resolveArtist } from "@/lib/music/artist-authority";
import { collapseArtistRows } from "@/lib/music/search-artists";
import type { MusicCatalogItem } from "@/lib/music/types";
import { useT, useUiLanguage } from "@/lib/i18n";
import { MusicBillboardRank } from "./music-billboard-rank";
import { MusicSearchAudience } from "./music-search-audience";

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;
const CAP = { artists: 3, tracks: 5, albums: 3 } as const;

type Group = { key: "artists" | "tracks" | "albums"; label: string; items: MusicCatalogItem[] };
type Suggest = { query: string; results: Awaited<ReturnType<typeof searchTyped>> };

export function useMusicSuggest(query: string, connector: string | null, enabled: boolean) {
  const t = useT();
  const language = useUiLanguage();
  const [found, setFound] = useState<Suggest | null>(null);
  const [pass, setPass] = useState(0);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < MIN_CHARS) {
      generation.current += 1;
      setFound(null);
      setLoading(false);
      return;
    }
    const mine = ++generation.current;
    setFound(null);
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchTyped(trimmed, 8, connector ?? undefined)
        .then((res) => {
          if (generation.current !== mine) return;
          setFound({ query: trimmed, results: res });
          // Only the visible artist suggestions need audience enrichment; the authority caches probes.
          const visible = [...new Map(res.artists.slice(0, CAP.artists).map((artist) => [artistIdentityKey(artist.name), artist])).values()];
          for (const artist of visible) {
            if (peekArtistIdentity(artist.name).probed) continue;
            void resolveArtist(artist.name, { hint: res.artists.filter((ref) => artistIdentityKey(ref.name) === artistIdentityKey(artist.name)) })
              .catch(() => null).then(() => { if (generation.current === mine) setPass((value) => value + 1); });
          }
          const key = artistIdentityKey(trimmed);
          const named = res.artists.filter((a) => artistIdentityKey(a.name) === key);
          if (named.length < 2 || peekArtistIdentity(trimmed).probed) return;
          void resolveArtist(named[0].name, { hint: named })
            .catch(() => null)
            .then(() => {
              if (generation.current === mine) setPass((value) => value + 1);
            });
        })
        .catch(() => {
          if (generation.current === mine) setFound(null);
        }).finally(() => { if (generation.current === mine) setLoading(false); });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, connector, enabled]);

  const groups = useMemo(() => {
    if (!enabled || !found || found.query !== query.trim()) return [];
    const res = found.results;
    const next: Group[] = [
      {
        key: "artists",
        label: t("music.search.artists"),
        items: collapseArtistRows(
          res.artists,
          language,
          t("music.metadata.deezerFans"),
          artistIdentityKey(found.query),
        )
          .slice(0, CAP.artists)
          .map((a) => ({ kind: "artist", ...a })),
      },
      {
        key: "tracks",
        label: t("music.search.tracks"),
        items: res.tracks.slice(0, CAP.tracks).map((a) => ({ kind: "track", ...a })),
      },
      {
        key: "albums",
        label: t("music.search.albums"),
        items: res.albums.slice(0, CAP.albums).map((a) => ({ kind: "album", ...a })),
      },
    ];
    return next.filter((g) => g.items.length > 0);
  }, [found, pass, t, language, enabled, query]);
  return { groups, loading };
}

function artOf(item: MusicCatalogItem): string | null {
  if (item.kind === "artist") return item.artwork ?? null;
  if (item.kind === "album" || item.kind === "track") return item.artwork || null;
  return null;
}

function titleOf(item: MusicCatalogItem): string {
  if (item.kind === "artist") return item.name;
  if (item.kind === "album") return item.title;
  if (item.kind === "track") return item.title;
  return "";
}

function subtitleOf(item: MusicCatalogItem): string {
  if (item.kind === "artist") return item.subtitle ?? "";
  if (item.kind === "album") return item.artist;
  if (item.kind === "track") return item.artist;
  return "";
}

function GlyphFor({ kind }: { kind: MusicCatalogItem["kind"] }) {
  if (kind === "artist") return <Mic2 size={13} aria-hidden />;
  if (kind === "album") return <Disc3 size={13} aria-hidden />;
  return <Music2 size={13} aria-hidden />;
}

export function MusicSearchSuggest({
  groups,
  activeIndex,
  onPick,
  onHover,
}: {
  groups: Group[];
  activeIndex: number;
  onPick: (item: MusicCatalogItem) => void;
  onHover: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-suggest-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!flat.length) return null;

  let index = -1;
  return (
    <div
      ref={listRef}
      data-music-search-panel
      role="listbox"
      aria-label="search suggestions"
      className="harbor-float animate-menu-in max-h-[min(560px,60vh)] overflow-y-auto overscroll-contain rounded-md bg-elevated p-1 ring-1 ring-edge-soft"
    >
      {groups.map((group) => (
        <div key={group.key}>
          <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {group.label}
          </div>
          {group.items.map((item) => {
            index += 1;
            const i = index;
            const art = artOf(item);
            const sub = subtitleOf(item);
            return (
              <button
                key={`${item.kind}:${item.id}`}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                data-suggest-index={i}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => onHover(i)}
                onClick={() => onPick(item)}
                className={`flex h-[62px] w-full items-center gap-3 rounded-md px-3 text-start transition-colors duration-150 ease-out ${
                  i === activeIndex ? "bg-raised" : ""
                }`}
              >
                <span
                  className={`grid size-[44px] shrink-0 place-items-center overflow-hidden bg-canvas/60 text-ink-subtle ${
                    item.kind === "artist" ? "rounded-full" : "rounded-[5px]"
                  }`}
                >
                  {art ? (
                    <img
                      src={art}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  ) : (
                    <GlyphFor kind={item.kind} />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12.5px] text-ink">{titleOf(item)}</span>
                  {item.kind === "artist" ? <MusicSearchAudience artist={item} /> : sub ? <span className="truncate text-[11px] text-ink-subtle">{sub}</span> : null}
                </span>
                {item.kind === "track" && (
                  <MusicBillboardRank
                    title={item.title}
                    artist={item.artist}
                    logoSize={11}
                    className="ms-auto inline-flex shrink-0 items-center gap-1 text-[10.5px] font-semibold text-ink-subtle"
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export type { Group as MusicSuggestGroup };
