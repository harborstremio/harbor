import { authToken } from "./theme-auth";
import { clientId, type MyUpload } from "./theme-store";
import { installAwardPack, type AwardPack } from "./award-icons";
import { installStreamBadgePack } from "./community-badge-packs";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const ORIGIN = HARBOR_API_BASE;
const API = `${ORIGIN}/themes/api`;
const UPLOADS_KEY = "harbor.bundle-uploads.v1";

export type BundleKind = "badge" | "award";

export type BundleIcon = { key: string; url: string };

export type StoreBundle = {
  id: string;
  kind: BundleKind;
  name: string;
  author: string;
  authorAvatar: string | null;
  description: string;
  cover: string | null;
  icons: BundleIcon[];
  downloads: number;
  ratingAvg: number;
  ratingCount: number;
  visibility: "public" | "unlisted";
  status: "pending" | "approved" | "rejected";
  share: string;
  createdAt: string;
  updatedAt?: string;
  versionsCount?: number;
};

export type BundleIconBlob = { key: string; blob: Blob };

export type BundleUploadResult = {
  id: string;
  kind: BundleKind;
  ownerToken: string;
  share: string;
};

function abs(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith("http") ? u : `${ORIGIN}${u}`;
}

function bust(u: string | null, rev: string | number | undefined): string | null {
  if (!u || rev == null || rev === "") return u;
  return `${u}${u.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(rev))}`;
}

function authHeaders(): Record<string, string> {
  const token = authToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalize(b: Record<string, unknown>): StoreBundle {
  const rev = (b.versionsCount as number | undefined) ?? (b.updatedAt as string | undefined);
  const icons = ((b.icons as BundleIcon[]) || [])
    .filter((i) => i && typeof i.key === "string" && typeof i.url === "string")
    .map((i) => ({ key: i.key, url: bust(abs(i.url), rev) as string }));
  return {
    ...(b as unknown as StoreBundle),
    authorAvatar: abs(b.authorAvatar as string | null),
    cover: bust(abs(b.cover as string | null), rev),
    icons,
  };
}

export async function browseBundles(
  kind: BundleKind,
  sort = "top",
  q = "",
): Promise<StoreBundle[]> {
  const params = new URLSearchParams({ kind, sort });
  if (q) params.set("q", q);
  const r = await fetch(`${API}/bundles?${params.toString()}`);
  if (!r.ok) throw new Error("Could not reach the bundle library.");
  const d = await r.json();
  return (d.bundles || []).map(normalize);
}

export async function getBundle(id: string): Promise<StoreBundle> {
  const r = await fetch(`${API}/bundles/${id}?clientId=${encodeURIComponent(clientId())}`);
  if (!r.ok) throw new Error("Bundle not found.");
  return normalize(await r.json());
}

export async function rateBundle(id: string, value: number): Promise<StoreBundle> {
  const r = await fetch(`${API}/bundles/${id}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, clientId: clientId() }),
  });
  if (!r.ok) throw new Error("Could not save your rating.");
  return normalize(await r.json());
}

export function getMyBundleUploads(): MyUpload[] {
  try {
    const v = JSON.parse(localStorage.getItem(UPLOADS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveMyBundleUploads(list: MyUpload[]): void {
  try {
    localStorage.setItem(UPLOADS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function recordBundleUpload(u: MyUpload): void {
  saveMyBundleUploads([u, ...getMyBundleUploads().filter((x) => x.id !== u.id)]);
}

export function forgetBundleUpload(id: string): void {
  saveMyBundleUploads(getMyBundleUploads().filter((x) => x.id !== id));
}

const BUNDLE_TOO_LARGE =
  "This bundle is too large to publish. Use fewer badges or smaller art, then try again.";
const BUNDLE_UNREACHABLE =
  "Couldn't reach the bundle library. Check your connection, or if the bundle is very large try fewer or smaller icons.";

async function postBundleForm(url: string, fd: FormData): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch(url, { method: "POST", headers: authHeaders(), body: fd });
  } catch {
    throw new Error(BUNDLE_UNREACHABLE);
  }
  if (r.status === 413) throw new Error(BUNDLE_TOO_LARGE);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || "Upload failed.");
  return d as Record<string, unknown>;
}

export async function uploadBundle(
  manifestJson: string,
  cover: Blob,
  icons: BundleIconBlob[],
  author: string,
): Promise<BundleUploadResult> {
  const fd = new FormData();
  fd.append("manifest", new Blob([manifestJson], { type: "application/json" }), "manifest.json");
  fd.append("cover", cover, "cover.png");
  for (const icon of icons) fd.append("icons", icon.blob, `${icon.key}.png`);
  if (author) fd.append("author", author);
  const d = await postBundleForm(`${API}/bundles`, fd);
  return d as unknown as BundleUploadResult;
}

export async function updateBundle(
  id: string,
  manifestJson: string | null,
  cover: Blob | null,
  icons: BundleIconBlob[],
  changelog: string,
): Promise<StoreBundle> {
  const fd = new FormData();
  if (manifestJson)
    fd.append("manifest", new Blob([manifestJson], { type: "application/json" }), "manifest.json");
  if (cover) fd.append("cover", cover, "cover.png");
  for (const icon of icons) fd.append("icons", icon.blob, `${icon.key}.png`);
  if (changelog) fd.append("changelog", changelog);
  const d = await postBundleForm(`${API}/bundles/${id}/update`, fd);
  return normalize(d);
}

export async function myBundles(): Promise<StoreBundle[]> {
  const r = await fetch(`${API}/me/bundles`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Could not load your bundles.");
  const d = await r.json();
  return (d.bundles || []).map(normalize);
}

export async function deleteBundle(id: string, ownerToken: string): Promise<void> {
  const r = await fetch(`${API}/bundles/${id}/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (!r.ok) throw new Error("Could not delete.");
  forgetBundleUpload(id);
}

export async function reportBundle(id: string, reason?: string): Promise<void> {
  const r = await fetch(`${API}/bundles/${id}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: reason ?? "" }),
  });
  if (!r.ok) throw new Error("Could not send report.");
}

function toAwardPack(b: StoreBundle): AwardPack {
  return {
    name: b.name,
    author: b.author,
    description: b.description,
    version: b.versionsCount != null ? String(b.versionsCount) : undefined,
    icons: Object.fromEntries(b.icons.map((i) => [i.key, i.url])),
  };
}

export function installBundle(b: StoreBundle): void {
  if (b.kind === "badge") {
    installStreamBadgePack({ id: b.id, name: b.name, author: b.author, icons: b.icons });
  } else {
    installAwardPack(toAwardPack(b));
  }
}
