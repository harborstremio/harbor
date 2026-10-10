import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { animeDetails } from "@/lib/providers/anime-detail";
import type { CastEntry, TmdbDetail } from "@/lib/providers/tmdb";
import type { AnimeCharacter } from "@/lib/providers/anime-characters";
import type { AnilistRelatedNode } from "@/lib/anilist/media-details";

export const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

export function isAnimeId(id: string): boolean {
  return ANIME_ID.test(id);
}

function syncCanonical(id: string): string | null {
  if (id.startsWith("kitsu:") || id.startsWith("anilist:")) return id;
  return null;
}

export function useAnimeDetail(
  meta: Meta,
  isAnime: boolean,
): { detail: TmdbDetail | null; canonicalId: string | null; loading: boolean } {
  const { settings } = useSettings();
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [resolvedKitsu, setResolvedKitsu] = useState<string | null>(null);
  const [loading, setLoading] = useState(isAnime);

  useEffect(() => {
    setDetail(null);
    setResolvedKitsu(null);
    if (!isAnime) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    animeDetails(settings, meta)
      .then(async (res) => {
        if (!alive || !res) {
          if (alive) setLoading(false);
          return;
        }
        setResolvedKitsu(`kitsu:${res.kitsuId}`);
        setDetail(res.detail);
        setLoading(false);
        const extras = await res.extrasPromise.catch(() => null);
        if (!alive || !extras) return;
        setDetail((prev) => (prev ? mergeExtras(prev, extras) : prev));
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAnime, meta.id]);

  const canonicalId = useMemo(
    () => syncCanonical(meta.id) ?? resolvedKitsu,
    [meta.id, resolvedKitsu],
  );

  return { detail, canonicalId, loading };
}

type ExtrasPatch = {
  logo?: string;
  backdrop?: string;
  poster?: string;
  imdbId?: string | null;
  gallery?: TmdbDetail["gallery"];
  crew?: TmdbDetail["crew"];
  directors?: TmdbDetail["directors"];
  writers?: TmdbDetail["writers"];
  creators?: TmdbDetail["creators"];
  producers?: TmdbDetail["producers"];
  composer?: TmdbDetail["composer"];
  cinematography?: TmdbDetail["cinematography"];
  editor?: TmdbDetail["editor"];
  cast?: CastEntry[];
};

function mergeExtras(detail: TmdbDetail, extras: ExtrasPatch): TmdbDetail {
  return {
    ...detail,
    logo: extras.logo ?? detail.logo,
    backdrop: extras.backdrop ?? detail.backdrop,
    poster: extras.poster ?? detail.poster,
    imdbId: extras.imdbId ?? detail.imdbId,
    gallery: extras.gallery ?? detail.gallery,
    crew: extras.crew ?? detail.crew,
    directors: extras.directors ?? detail.directors,
    writers: extras.writers ?? detail.writers,
    creators: extras.creators ?? detail.creators,
    producers: extras.producers ?? detail.producers,
    composer: extras.composer ?? detail.composer,
    cinematography: extras.cinematography ?? detail.cinematography,
    editor: extras.editor ?? detail.editor,
    cast: extras.cast && extras.cast.length > 0 ? extras.cast : detail.cast,
  };
}

const norm = (s: string) => s.trim().toLowerCase();

export function dedupeCast(cast: CastEntry[]): CastEntry[] {
  const ids = new Set<number>();
  const names = new Set<string>();
  const out: CastEntry[] = [];
  for (const c of cast) {
    const nk = norm(c.name);
    if ((c.id > 0 && ids.has(c.id)) || names.has(nk)) continue;
    if (c.id > 0) ids.add(c.id);
    names.add(nk);
    out.push(c);
  }
  return out;
}

export function dedupeCharacters(chars: AnimeCharacter[]): AnimeCharacter[] {
  const ids = new Set<number>();
  const names = new Set<string>();
  const out: AnimeCharacter[] = [];
  for (const c of chars) {
    const nk = norm(c.name);
    if (ids.has(c.id) || names.has(nk)) continue;
    ids.add(c.id);
    names.add(nk);
    out.push(c);
  }
  return out;
}

export function dedupeRelated(nodes: AnilistRelatedNode[]): AnilistRelatedNode[] {
  const ids = new Set<number>();
  const titles = new Set<string>();
  const out: AnilistRelatedNode[] = [];
  for (const n of nodes) {
    const tk = norm(n.title);
    if (ids.has(n.anilistId) || titles.has(tk)) continue;
    ids.add(n.anilistId);
    titles.add(tk);
    out.push(n);
  }
  return out;
}

export function dedupeMeta(
  items: Meta[],
  seenIds?: Set<string>,
  seenNames?: Set<string>,
): Meta[] {
  const ids = seenIds ?? new Set<string>();
  const names = seenNames ?? new Set<string>();
  const out: Meta[] = [];
  for (const m of items) {
    const nk = norm(m.name);
    if (ids.has(m.id) || names.has(nk)) continue;
    ids.add(m.id);
    names.add(nk);
    out.push(m);
  }
  return out;
}
