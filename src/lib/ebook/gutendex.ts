import { safeFetch, safeFetchBytes } from "@/lib/safe-fetch";

export const GUTENDEX_ID = "gutendex";
export const GUTENDEX_NAME = "Project Gutenberg";
export const GUTENDEX_BASE = "https://gutendex.com";
export const GUTENDEX_PAGE_SIZE = 32;

export type GutendexBook = {
  id: number;
  title: string;
  authors: string[];
  subjects: string[];
  cover?: string;
  epubUrl?: string;
  downloads: number;
  year?: number;
};

type RawBook = {
  id?: number;
  title?: string;
  authors?: { name?: string; birth_year?: number | null }[];
  subjects?: string[];
  bookshelves?: string[];
  formats?: Record<string, string>;
  download_count?: number;
};

function pickEpub(formats: Record<string, string> | undefined): string | undefined {
  if (!formats) return undefined;
  for (const [type, url] of Object.entries(formats)) {
    if (type.startsWith("application/epub+zip") && !url.endsWith(".zip")) return url;
  }
  return undefined;
}

function pickCover(formats: Record<string, string> | undefined): string | undefined {
  if (!formats) return undefined;
  for (const [type, url] of Object.entries(formats)) {
    if (type.startsWith("image/jpeg")) return url;
  }
  return undefined;
}

function normaliseAuthor(name: string): string {
  const parts = name.split(",").map((part) => part.trim());
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
}

function toBook(raw: RawBook): GutendexBook | null {
  if (typeof raw.id !== "number" || !raw.title) return null;
  return {
    id: raw.id,
    title: raw.title,
    authors: (raw.authors ?? []).map((a) => normaliseAuthor(a.name ?? "")).filter(Boolean),
    subjects: [...(raw.subjects ?? []), ...(raw.bookshelves ?? [])].slice(0, 8),
    cover: pickCover(raw.formats),
    epubUrl: pickEpub(raw.formats),
    downloads: raw.download_count ?? 0,
  };
}

async function query(path: string): Promise<GutendexBook[]> {
  const response = await safeFetch(`${GUTENDEX_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Gutendex ${response.status}`);
  const data = (await response.json()) as { results?: RawBook[] };
  return (data.results ?? []).map(toBook).filter((b): b is GutendexBook => !!b && !!b.epubUrl);
}

export function gutendexPage(offset: number): number {
  return Math.floor(offset / GUTENDEX_PAGE_SIZE) + 1;
}

export async function gutendexPopular(offset: number): Promise<GutendexBook[]> {
  return query(`/books?languages=en&page=${gutendexPage(offset)}`);
}

export async function gutendexSearch(term: string, offset: number): Promise<GutendexBook[]> {
  const trimmed = term.trim();
  if (!trimmed) return gutendexPopular(offset);
  return query(`/books?search=${encodeURIComponent(trimmed)}&page=${gutendexPage(offset)}`);
}

export async function gutendexDetail(id: string): Promise<GutendexBook | null> {
  const response = await safeFetch(`${GUTENDEX_BASE}/books/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return toBook((await response.json()) as RawBook);
}

export async function gutendexEpub(url: string): Promise<ArrayBuffer> {
  const response = await safeFetchBytes(url, undefined, 60000);
  if (!response.ok) throw new Error(`Gutenberg download ${response.status}`);
  return response.arrayBuffer();
}
