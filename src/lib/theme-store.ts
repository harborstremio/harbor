import { parseThemeJson, saveCustomTheme, type CustomTheme } from "@/lib/custom-themes";

const ORIGIN = "https://harbor.site";
const API = `${ORIGIN}/themes/api`;
const UPLOADS_KEY = "harbor.theme-uploads.v1";
const CLIENT_KEY = "harbor.theme-client-id";

export type StoreTheme = {
  id: string;
  name: string;
  author: string;
  blurb: string;
  swatch: string[];
  cover: string | null;
  screenshots: string[];
  layout: string | null;
  downloads: number;
  ratingAvg: number;
  ratingCount: number;
  visibility: "public" | "unlisted";
  status: "pending" | "approved" | "rejected";
  share: string;
  createdAt: string;
};

function abs(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith("http") ? u : `${ORIGIN}${u}`;
}

function normalize(t: Record<string, unknown>): StoreTheme {
  return {
    ...(t as unknown as StoreTheme),
    cover: abs(t.cover as string | null),
    screenshots: ((t.screenshots as string[]) || []).map((s) => abs(s) as string).filter(Boolean),
  };
}

export function clientId(): string {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
      .replace(/-/g, "")
      .slice(0, 24);
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export async function browseThemes(sort = "top", q = ""): Promise<StoreTheme[]> {
  const url = `${API}/themes?sort=${encodeURIComponent(sort)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not reach the theme library.");
  const d = await r.json();
  return (d.themes || []).map(normalize);
}

export async function downloadTheme(id: string, preview?: string | null): Promise<CustomTheme> {
  const r = await fetch(`${API}/themes/${id}/file`);
  if (!r.ok) throw new Error("Download failed.");
  const parsed = parseThemeJson(await r.text());
  if (!parsed.ok) throw new Error(parsed.error);
  const theme = preview ? { ...parsed.theme, previewImage: preview } : parsed.theme;
  saveCustomTheme(theme);
  markUnseenDownload(theme.id);
  return theme;
}

const UNSEEN_KEY = "harbor.theme-unseen.v1";
const unseenSubs = new Set<() => void>();

function readUnseen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(UNSEEN_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeUnseen(ids: string[]): void {
  try {
    localStorage.setItem(UNSEEN_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  for (const fn of unseenSubs) fn();
}

export function getUnseenDownloads(): string[] {
  return readUnseen();
}

export function markUnseenDownload(id: string): void {
  const cur = readUnseen();
  if (!cur.includes(id)) writeUnseen([...cur, id]);
}

export function clearUnseenDownloads(): void {
  if (readUnseen().length) writeUnseen([]);
}

export function subscribeUnseen(fn: () => void): () => void {
  unseenSubs.add(fn);
  return () => {
    unseenSubs.delete(fn);
  };
}

export async function rateTheme(id: string, value: number): Promise<StoreTheme> {
  const r = await fetch(`${API}/themes/${id}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, clientId: clientId() }),
  });
  if (!r.ok) throw new Error("Could not save your rating.");
  return normalize(await r.json());
}

export type MyUpload = { id: string; ownerToken: string; name: string; share: string };

export function getMyUploads(): MyUpload[] {
  try {
    const v = JSON.parse(localStorage.getItem(UPLOADS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveMyUploads(list: MyUpload[]): void {
  try {
    localStorage.setItem(UPLOADS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function recordUpload(u: MyUpload): void {
  saveMyUploads([u, ...getMyUploads().filter((x) => x.id !== u.id)]);
}

export function forgetUpload(id: string): void {
  saveMyUploads(getMyUploads().filter((x) => x.id !== id));
}

export async function uploadTheme(
  themeJson: string,
  cover: Blob,
  screenshots: Blob[],
  author: string,
): Promise<{ id: string; ownerToken: string; share: string }> {
  const fd = new FormData();
  fd.append("theme", new Blob([themeJson], { type: "application/json" }), "theme.json");
  fd.append("cover", cover, "cover.png");
  for (const s of screenshots.slice(0, 6)) fd.append("screenshots", s, "shot.png");
  if (author) fd.append("author", author);
  const r = await fetch(`${API}/themes`, { method: "POST", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Upload failed.");
  return d;
}

export async function setVisibility(
  id: string,
  ownerToken: string,
  visibility: "public" | "unlisted",
): Promise<void> {
  const r = await fetch(`${API}/themes/${id}/visibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ visibility }),
  });
  if (!r.ok) throw new Error("Could not change visibility.");
}

export async function deleteUpload(id: string, ownerToken: string): Promise<void> {
  const r = await fetch(`${API}/themes/${id}/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!r.ok) throw new Error("Could not delete.");
  forgetUpload(id);
}
