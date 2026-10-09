import { authToken } from "@/lib/theme-auth";
import type { ProfileSummary } from "@/views/profile/profile-types";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;
const WIDTH = 1500;
const HEIGHT = 500;

export async function fileToBannerWebp(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("That image could not be read."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
    );
    if (!blob) throw new Error("Could not process image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function unwrap(r: Response): Promise<ProfileSummary> {
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error || "Could not update banner.");
  return d as ProfileSummary;
}

export async function uploadBanner(blob: Blob): Promise<ProfileSummary> {
  const token = authToken();
  if (!token) throw new Error("Sign in first.");
  const fd = new FormData();
  fd.append("banner", blob, "banner.webp");
  const r = await fetch(`${API}/social/profile/banner`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return unwrap(r);
}

export async function removeBanner(): Promise<ProfileSummary> {
  const token = authToken();
  if (!token) throw new Error("Sign in first.");
  const r = await fetch(`${API}/social/profile/banner/remove`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap(r);
}
