import { authToken, currentAuthor } from "@/lib/theme-auth";
import { removeAvatar, uploadAvatar } from "@/lib/social/avatar";

const MARK_PREFIX = "harbor.avatar-synced.";
const UPLOAD_SIZE = 256;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function markKey(id: string): string {
  return MARK_PREFIX + id;
}

function readMark(id: string): string | null {
  try {
    return localStorage.getItem(markKey(id));
  } catch {
    return null;
  }
}

function writeMark(id: string, value: string): void {
  try {
    localStorage.setItem(markKey(id), value);
  } catch {
    void 0;
  }
}

async function dataUrlToBlob(src: string): Promise<Blob | null> {
  try {
    return await (await fetch(src)).blob();
  } catch {
    return null;
  }
}

async function toWebp(src: string, size: number): Promise<Blob | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load"));
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.9));
  } catch {
    return null;
  }
}

export async function pushAvatarToEcosystem(value: string | null): Promise<void> {
  const author = currentAuthor();
  if (!author || !authToken()) return;
  const key = value ? hash(value) : "none";
  const prev = readMark(author.id);
  if (prev === key) return;
  if (!value) {
    if (prev === null) return;
    try {
      await removeAvatar();
      writeMark(author.id, "none");
    } catch {
      void 0;
    }
    return;
  }
  try {
    const blob = value.startsWith("data:") ? await dataUrlToBlob(value) : await toWebp(value, UPLOAD_SIZE);
    if (!blob) return;
    await uploadAvatar(blob);
    writeMark(author.id, key);
  } catch {
    void 0;
  }
}

export function markAvatarSynced(value: string | null): void {
  const author = currentAuthor();
  if (!author) return;
  writeMark(author.id, value ? hash(value) : "none");
}
