import { useCallback, useEffect, useRef, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { useT } from "@/lib/i18n";
import { authToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import {
  searchFavorites,
  type FavoriteKind,
  type FavoriteMedia,
  type FavoriteSearchResult,
} from "@/lib/providers/favorites-types";
import type { ProfileSummary } from "./profile-types";

export type { FavoriteKind, FavoriteMedia } from "@/lib/providers/favorites-types";

const BASE = `${HARBOR_API_BASE}/themes/api/social`;

export const FAVORITE_DISPLAY_CAP = 12;
export const FAVORITE_STORE_CAP = 12;
export const FAVORITE_KINDS: FavoriteKind[] = ["game", "book", "music"];

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export type FavoriteLists = Record<FavoriteKind, FavoriteMedia[]>;

function emptyLists(): FavoriteLists {
  return { game: [], book: [], music: [] };
}

function cloneLists(l: FavoriteLists): FavoriteLists {
  return { game: [...l.game], book: [...l.book], music: [...l.music] };
}

function safeText(value: unknown, max: number): string {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof raw !== "string") return "";
  return raw.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function toMedia(raw: unknown, kind: FavoriteKind): FavoriteMedia | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = safeText(r.id, 96);
  const name = safeText(r.name, 120);
  if (!id || !name) return null;
  return {
    kind,
    id,
    name,
    image: safeUrl(r.image),
    sub: safeText(r.sub, 80) || null,
    url: safeUrl(r.url),
    source: safeText(r.source, 32),
  };
}

function toMediaList(raw: unknown, kind: FavoriteKind): FavoriteMedia[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FavoriteMedia[] = [];
  for (const item of raw) {
    const media = toMedia(item, kind);
    if (!media || seen.has(media.id)) continue;
    seen.add(media.id);
    out.push(media);
    if (out.length >= FAVORITE_STORE_CAP) break;
  }
  return out;
}

export function readFavorites(data: unknown): FavoriteLists {
  const fav = (data as { favorites?: unknown } | null)?.favorites as
    | Record<string, unknown>
    | null
    | undefined;
  return {
    game: toMediaList(fav?.game, "game"),
    book: toMediaList(fav?.book, "book"),
    music: toMediaList(fav?.music, "music"),
  };
}

function authHeaders(): Record<string, string> {
  const token = authToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchFavorites(handle: string, signal?: AbortSignal): Promise<FavoriteLists> {
  const res = await safeFetch(`${BASE}/u/${encodeURIComponent(handle)}`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`favorites ${res.status}`);
  return readFavorites(await res.json());
}

function toStored(media: FavoriteMedia[]): FavoriteMedia[] {
  return media.slice(0, FAVORITE_STORE_CAP);
}

export async function saveFavorites(lists: FavoriteLists): Promise<ProfileSummary> {
  const favorites = {
    game: toStored(lists.game),
    book: toStored(lists.book),
    music: toStored(lists.music),
  };
  const total = favorites.game.length + favorites.book.length + favorites.music.length;
  const body: Record<string, unknown> = { favorites };
  if (total === 0) body.clearFavorites = true;
  const res = await safeFetch(`${BASE}/me/profile`, {
    method: "PATCH",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`save favorites ${res.status}`);
  return (await res.json()) as ProfileSummary;
}

function persisted(sent: FavoriteMedia[], echoed: FavoriteMedia[]): boolean {
  if (sent.length === 0) return echoed.length === 0;
  if (echoed.length !== sent.length) return false;
  const ids = new Set(echoed.map((m) => m.id));
  return sent.every((m) => ids.has(m.id));
}

export type FavoritesController = {
  entries: FavoriteLists;
  loaded: boolean;
  loadFailed: boolean;
  saving: boolean;
  save: (kind: FavoriteKind, next: FavoriteMedia[]) => Promise<ProfileSummary | null>;
  reload: () => void;
};

export function useFavorites(handle: string, initial?: FavoriteLists | null): FavoritesController {
  const hasSeed = !!initial;
  const [entries, setEntries] = useState<FavoriteLists>(() =>
    initial ? cloneLists(initial) : emptyLists(),
  );
  const [loaded, setLoaded] = useState(hasSeed);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (attempt === 0 && hasSeed) {
      setLoaded(true);
      setLoadFailed(false);
      return;
    }
    if (!handle) {
      setLoaded(true);
      setLoadFailed(false);
      return;
    }
    const ac = new AbortController();
    setLoaded(false);
    setLoadFailed(false);
    fetchFavorites(handle, ac.signal)
      .then((next) => {
        if (ac.signal.aborted) return;
        setEntries(next);
        setLoaded(true);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setLoadFailed(true);
        setLoaded(true);
      });
    return () => ac.abort();
  }, [handle, hasSeed, attempt]);

  const save = useCallback(async (kind: FavoriteKind, next: FavoriteMedia[]) => {
    const prev = entriesRef.current;
    const capped = next.slice(0, FAVORITE_STORE_CAP);
    const merged = { ...prev, [kind]: capped };
    setEntries(merged);
    setSaving(true);
    try {
      const summary = await saveFavorites(merged);
      const echoed = readFavorites(summary);
      if (!persisted(capped, echoed[kind])) {
        setEntries(prev);
        return null;
      }
      setEntries(echoed);
      return summary;
    } catch {
      setEntries(prev);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { entries, loaded, loadFailed, saving, save, reload };
}

export type SearchView = { status: "idle" } | { status: "searching" } | FavoriteSearchResult;

export function useFavoriteSearch(
  kind: FavoriteKind,
  query: string,
): SearchView & { retry: () => void } {
  const [debounced, setDebounced] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<SearchView>({ status: "idle" });

  useEffect(() => {
    const next = query.trim();
    if (next === debounced) return;
    const id = window.setTimeout(() => setDebounced(next), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query, debounced]);

  useEffect(() => {
    if (debounced.length < MIN_QUERY) {
      setView({ status: "idle" });
      return;
    }
    const ac = new AbortController();
    setView({ status: "searching" });
    searchFavorites(kind, debounced, { signal: ac.signal })
      .then((result) => {
        if (!ac.signal.aborted) setView(result);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setView({ status: "failed", reason: "Search failed." });
      });
    return () => ac.abort();
  }, [kind, debounced, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...view, retry };
}

export type FavoriteCopy = {
  title: string;
  hint: string;
  placeholder: string;
  idle: string;
  idleBody: string;
  noResults: string;
  failed: string;
  needsKey: string;
  atCap: string;
};

export function useFavoriteCopy(kind: FavoriteKind): FavoriteCopy {
  const t = useT();
  const max = FAVORITE_DISPLAY_CAP;
  if (kind === "game") {
    return {
      title: t("Favourite games"),
      hint: t("Pick up to {max} games to show on your profile.", { max }),
      placeholder: t("Search games"),
      idle: t("Search for a game"),
      idleBody: t("Type a title to find its cover art."),
      noResults: t("No games match that search"),
      failed: t("Could not reach the game database"),
      needsKey: t("Game search needs an API key before it can run."),
      atCap: t("That's {max} games. Remove one to add another.", { max }),
    };
  }
  if (kind === "book") {
    return {
      title: t("Favourite books"),
      hint: t("Pick up to {max} books to show on your profile.", { max }),
      placeholder: t("Search books"),
      idle: t("Search for a book"),
      idleBody: t("Type a title to find its cover."),
      noResults: t("No books match that search"),
      failed: t("Could not reach the book database"),
      needsKey: t("Book search needs an API key before it can run."),
      atCap: t("That's {max} books. Remove one to add another.", { max }),
    };
  }
  return {
    title: t("Favourite music"),
    hint: t("Pick up to {max} artists to show on your profile.", { max }),
    placeholder: t("Search artists"),
    idle: t("Search for an artist"),
    idleBody: t("Type a name to find their photo."),
    noResults: t("No artists match that search"),
    failed: t("Could not reach the music database"),
    needsKey: t("Music search needs an API key before it can run."),
    atCap: t("That's {max} artists. Remove one to add another.", { max }),
  };
}
