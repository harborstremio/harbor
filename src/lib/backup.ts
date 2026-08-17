import { downloadText } from "@/lib/download-text";
import { loadBgImage, saveBgImage } from "@/lib/theme-storage";
import { readAllProfilesIdentity } from "@/lib/profiles";

declare const __APP_VERSION__: string;

const FORMAT = "harbor-backup";
const VERSION = 1;

export type Backup = {
  format: string;
  version: number;
  app: string;
  exportedAt: string;
  data: Record<string, string>;
  bgImages?: Record<string, string>;
  /** @deprecated legacy single-image field from before per-profile backgrounds; still read on restore */
  bgImage?: string | null;
};

function isPortable(key: string): boolean {
  if (!key.startsWith("harbor.")) return false;
  if (key === "harbor.auth" || key.startsWith("harbor.auth.")) return false;
  if (key === "harbor.together.clientId") return false;
  return true;
}

export async function buildBackup(): Promise<Backup> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isPortable(key)) continue;
    const value = localStorage.getItem(key);
    if (value != null) data[key] = value;
  }
  const bgImages: Record<string, string> = {};
  for (const { id } of readAllProfilesIdentity()) {
    const img = await loadBgImage(id);
    if (img) bgImages[id] = img;
  }
  return {
    format: FORMAT,
    version: VERSION,
    app: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev",
    exportedAt: new Date().toISOString(),
    data,
    ...(Object.keys(bgImages).length ? { bgImages } : {}),
  };
}

export async function downloadBackup(): Promise<boolean> {
  const backup = await buildBackup();
  const text = JSON.stringify(backup, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return downloadText(`harbor-backup-${stamp}.harbx`, text, ["harbx"], "Harbor backup");
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, error: "Unrecognized file." };
  }
  const b = json as Partial<Backup>;
  if (b.format !== FORMAT) {
    return { ok: false, error: "This is not a Harbor backup file." };
  }
  if (!b.data || typeof b.data !== "object") {
    return { ok: false, error: "This backup has no data in it." };
  }
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.data)) {
    if (typeof v === "string" && isPortable(k)) data[k] = v;
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, error: "This backup contained nothing restorable." };
  }
  const bgImages: Record<string, string> = {};
  if (b.bgImages && typeof b.bgImages === "object") {
    for (const [id, v] of Object.entries(b.bgImages)) {
      if (typeof v === "string") bgImages[id] = v;
    }
  }
  return {
    ok: true,
    backup: {
      format: FORMAT,
      version: typeof b.version === "number" ? b.version : VERSION,
      app: typeof b.app === "string" ? b.app : "unknown",
      exportedAt: typeof b.exportedAt === "string" ? b.exportedAt : "",
      data,
      ...(Object.keys(bgImages).length ? { bgImages } : {}),
      ...(typeof b.bgImage === "string" || b.bgImage === null ? { bgImage: b.bgImage } : {}),
    },
  };
}

export function backupKeyCount(backup: Backup): number {
  return Object.keys(backup.data).length;
}

export async function applyBackup(backup: Backup): Promise<void> {
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isPortable(key)) stale.push(key);
  }
  for (const key of stale) localStorage.removeItem(key);
  for (const [k, v] of Object.entries(backup.data)) {
    if (!isPortable(k)) continue;
    try {
      localStorage.setItem(k, v);
    } catch {
      /* keep restoring the rest even if one entry is rejected */
    }
  }
  if (backup.bgImages) {
    for (const [id, img] of Object.entries(backup.bgImages)) {
      try {
        await saveBgImage(img, id);
      } catch {
        /* background restore is best-effort */
      }
    }
  } else if (backup.bgImage !== undefined) {
    try {
      await saveBgImage(backup.bgImage);
    } catch {
      /* background restore is best-effort */
    }
  }
}
