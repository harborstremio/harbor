import { safeFetch } from "@/lib/safe-fetch";
import { authToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import {
  MAX_COLLECTIONS,
  MAX_COLLECTION_ITEMS,
  type Collection,
  type CollectionItem,
} from "@/lib/collections";

const BASE = `${HARBOR_API_BASE}/themes/api/social`;

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 675;
const BG_WIDTH = 1920;
const BG_HEIGHT = 1080;

export type CollectionImageResult = { url: string };

function authHeaders(): Record<string, string> {
  const t = authToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

function normalizeCollection(raw: unknown): Collection | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.name !== "string") return null;
  const items: CollectionItem[] = [];
  if (Array.isArray(e.items)) {
    for (const ri of e.items) {
      if (!ri || typeof ri !== "object") continue;
      const it = ri as Record<string, unknown>;
      if (typeof it.id !== "string") continue;
      items.push({
        id: it.id,
        type: it.type === "series" ? "series" : it.type === "manga" ? "manga" : "movie",
        name: typeof it.name === "string" ? it.name : "",
        poster: typeof it.poster === "string" ? it.poster : undefined,
      });
    }
  }
  const tags: string[] = [];
  if (Array.isArray(e.tags)) {
    for (const raw of e.tags) {
      if (typeof raw === "string" && raw.trim()) tags.push(raw.trim().slice(0, 24));
    }
  }
  return {
    id: e.id,
    name: e.name,
    description: typeof e.description === "string" ? e.description : undefined,
    coverImage: typeof e.coverImage === "string" ? e.coverImage : undefined,
    bgImage: typeof e.bgImage === "string" ? e.bgImage : undefined,
    tags: tags.length ? tags.slice(0, 8) : undefined,
    shared: e.shared === true ? true : undefined,
    items,
    createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
    updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : 0,
  };
}

function extractCollections(data: unknown): Collection[] {
  const list = (data as { collections?: unknown } | null)?.collections;
  if (!Array.isArray(list)) return [];
  const out: Collection[] = [];
  for (const raw of list) {
    const c = normalizeCollection(raw);
    if (c) out.push(c);
  }
  return out;
}

function trimForPublish(collections: Collection[]): Collection[] {
  return collections.slice(0, MAX_COLLECTIONS).map((c) => ({
    ...c,
    items: c.items.slice(0, MAX_COLLECTION_ITEMS),
  }));
}

export async function fetchUserCollections(
  handle: string,
  signal?: AbortSignal,
): Promise<Collection[]> {
  const res = await safeFetch(`${BASE}/u/${encodeURIComponent(handle)}`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`collections ${res.status}`);
  return extractCollections(await res.json());
}

export async function fetchSharedCollection(
  handle: string,
  collectionId: string,
  signal?: AbortSignal,
): Promise<Collection | null> {
  const collections = await fetchUserCollections(handle, signal);
  return collections.find((c) => c.id === collectionId) ?? null;
}

export type CommunityCollection = Collection & {
  handle: string;
  displayName: string;
  avatarUrl?: string;
};

function normalizeCommunityCollection(raw: unknown): CommunityCollection | null {
  const base = normalizeCollection(raw);
  if (!base) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.handle !== "string" || !e.handle) return null;
  return {
    ...base,
    handle: e.handle,
    displayName:
      typeof e.displayName === "string" && e.displayName.trim() ? e.displayName : e.handle,
    avatarUrl: typeof e.avatarUrl === "string" ? e.avatarUrl : undefined,
  };
}

export async function fetchCommunityCollections(
  signal?: AbortSignal,
): Promise<CommunityCollection[]> {
  const res = await safeFetch(`${BASE}/collections/community`, {
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`community collections ${res.status}`);
  const data = (await res.json()) as { collections?: unknown } | null;
  const list = data?.collections;
  if (!Array.isArray(list)) return [];
  const out: CommunityCollection[] = [];
  for (const raw of list) {
    const c = normalizeCommunityCollection(raw);
    if (c) out.push(c);
  }
  return out;
}

export async function publishCollections(
  collections: Collection[],
  clear = false,
): Promise<Collection[]> {
  const body: Record<string, unknown> = { collections: trimForPublish(collections) };
  if (clear) body.clearCollections = true;
  const res = await safeFetch(`${BASE}/me/profile`, {
    method: "PATCH",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`publish collections ${res.status}`);
  const echoed = extractCollections(await res.json());
  return echoed.length || collections.length === 0 ? echoed : collections;
}

export function collectionShareUrl(handle: string, collectionId: string): string {
  return `${HARBOR_API_BASE}/collection/${encodeURIComponent(handle)}/${encodeURIComponent(collectionId)}`;
}

export function collectionDeepLink(handle: string, collectionId: string): string {
  return `harbor://collection/${encodeURIComponent(handle)}/${encodeURIComponent(collectionId)}`;
}

export function collectionCode(handle: string, collectionId: string): string {
  return `${handle}/${collectionId}`;
}

async function fileToWebp(file: File, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("That image could not be read."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    const scale = Math.max(width / img.width, height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
    );
    if (!blob) throw new Error("Could not process image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

export async function fileToCollectionCover(file: File): Promise<string> {
  return blobToDataUrl(await fileToWebp(file, COVER_WIDTH, COVER_HEIGHT));
}

export async function fileToCollectionBackground(file: File): Promise<string> {
  return blobToDataUrl(await fileToWebp(file, BG_WIDTH, BG_HEIGHT));
}

async function readImageResult(r: Response): Promise<CollectionImageResult> {
  const d = (await r.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    coverImage?: string;
    bgImage?: string;
  };
  if (!r.ok) throw new Error(d.error || "Could not upload image.");
  return { url: d.url || d.coverImage || d.bgImage || "" };
}

async function postImage(
  path: string,
  field: "cover" | "bg",
  blob: Blob,
  filename: string,
): Promise<CollectionImageResult> {
  const token = authToken();
  if (!token) throw new Error("Sign in first.");
  const fd = new FormData();
  fd.append(field, blob, filename);
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return readImageResult(r);
}

async function postRemove(path: string): Promise<void> {
  const token = authToken();
  if (!token) throw new Error("Sign in first.");
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "Could not remove image.");
  }
}

export async function uploadCollectionCover(
  collectionId: string,
  file: File,
): Promise<CollectionImageResult> {
  const blob = await fileToWebp(file, COVER_WIDTH, COVER_HEIGHT);
  return postImage(
    `/collections/${encodeURIComponent(collectionId)}/cover`,
    "cover",
    blob,
    "cover.webp",
  );
}

export async function uploadCollectionBackground(
  collectionId: string,
  file: File,
): Promise<CollectionImageResult> {
  const blob = await fileToWebp(file, BG_WIDTH, BG_HEIGHT);
  return postImage(
    `/collections/${encodeURIComponent(collectionId)}/background`,
    "bg",
    blob,
    "background.webp",
  );
}

export async function removeCollectionCover(collectionId: string): Promise<void> {
  await postRemove(`/collections/${encodeURIComponent(collectionId)}/cover/remove`);
}

export async function removeCollectionBackground(collectionId: string): Promise<void> {
  await postRemove(`/collections/${encodeURIComponent(collectionId)}/background/remove`);
}
