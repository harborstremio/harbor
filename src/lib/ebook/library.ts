import type { EBook } from "./api";

const KEY = "harbor.ebook.library.v1";
const FAVORITES_KEY = "harbor.ebook.favorites.v1";
const READ_LATER_KEY = "harbor.ebook.read-later.v1";
const LEGACY_KEY = "harbor.novel.library.v1";
const LEGACY_FAVORITES_KEY = "harbor.novel.favorites.v1";

function read(key: string, legacyKey: string): EBook[] {
  try {
    const stored = localStorage.getItem(key) ?? localStorage.getItem(legacyKey) ?? "[]";
    if (!localStorage.getItem(key) && stored !== "[]") localStorage.setItem(key, stored);
    const value = JSON.parse(stored) as EBook[];
    return Array.isArray(value)
      ? value.map((ebook) => ({
          ...ebook,
          id: String(ebook.id).includes(":") ? String(ebook.id) : `anilist:${ebook.id}`,
          source: ebook.source ?? "anilist",
          authors: ebook.authors ?? [],
        }))
      : [];
  } catch {
    return [];
  }
}

export function ebookLibrary(): EBook[] {
  return read(KEY, LEGACY_KEY);
}

export function ebookInLibrary(id: string): boolean {
  return ebookLibrary().some((ebook) => ebook.id === id);
}

export function toggleEBookLibrary(ebook: EBook): boolean {
  const current = ebookLibrary();
  const exists = current.some((item) => item.id === ebook.id);
  localStorage.setItem(
    KEY,
    JSON.stringify(exists ? current.filter((item) => item.id !== ebook.id) : [ebook, ...current]),
  );
  window.dispatchEvent(new Event("harbor:ebook-library"));
  return !exists;
}
export function favoriteEBooks(): EBook[] {
  return read(FAVORITES_KEY, LEGACY_FAVORITES_KEY);
}

export function ebookIsFavorite(id: string): boolean {
  return favoriteEBooks().some((ebook) => ebook.id === id);
}

export function toggleEBookFavorite(ebook: EBook): boolean {
  const current = favoriteEBooks();
  const exists = current.some((item) => item.id === ebook.id);
  localStorage.setItem(
    FAVORITES_KEY,
    JSON.stringify(exists ? current.filter((item) => item.id !== ebook.id) : [ebook, ...current]),
  );
  window.dispatchEvent(new Event("harbor:ebook-library"));
  return !exists;
}

export function eBookReadLater(): EBook[] {
  return read(READ_LATER_KEY, "harbor.novel.read-later.v1");
}

export function eBookIsReadLater(id: string): boolean {
  return eBookReadLater().some((ebook) => ebook.id === id);
}

export function toggleEBookReadLater(ebook: EBook): boolean {
  const current = eBookReadLater();
  const exists = current.some((item) => item.id === ebook.id);
  localStorage.setItem(
    READ_LATER_KEY,
    JSON.stringify(exists ? current.filter((item) => item.id !== ebook.id) : [ebook, ...current]),
  );
  window.dispatchEvent(new Event("harbor:ebook-library"));
  return !exists;
}
