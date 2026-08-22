import { fetchInstalledAddons, fetchManifestAt, filterEnabled } from "@/lib/addon-store";
import { torboxAddonFor, userAddons, withDebridKeys, type Addon } from "@/lib/addons";
import { applyOrderToItems, loadDisplayOrder } from "@/lib/addons-store/reorder";
import { buildDebridClients } from "@/lib/debrid/registry";
import type { DebridStore } from "@/lib/debrid/types";
import { loadEffective } from "@/lib/settings/profile-store";
import type { Settings } from "@/lib/settings";

export type AutoDlContext = {
  settings: Settings;
  debrids: DebridStore[];
  addons: Addon[];
};

export function readAuthKey(): string | null {
  try {
    const raw = localStorage.getItem("harbor.auth");
    if (!raw) return null;
    return (JSON.parse(raw) as { authKey?: string }).authKey ?? null;
  } catch {
    return null;
  }
}

function readActiveSource(): { profileId: string; linked: boolean } {
  try {
    const raw = localStorage.getItem("harbor.profiles.v1");
    if (!raw) return { profileId: "default", linked: true };
    const s = JSON.parse(raw) as {
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
      activeId?: string | null;
    };
    const id = s.activeId || "default";
    const p = s.profiles?.find((x) => x.id === id);
    return { profileId: id, linked: p?.settingsLinked !== false };
  } catch {
    return { profileId: "default", linked: true };
  }
}

export function readSettings(): Settings {
  const src = readActiveSource();
  return loadEffective(src.profileId, src.linked);
}

function hasResources(a: Addon): boolean {
  return (a.manifest.resources ?? []).length > 0;
}

async function gatherStreamAddons(authKey: string | null, settings: Settings): Promise<Addon[]> {
  const stremio = filterEnabled(authKey ? await userAddons(authKey).catch(() => []) : []);
  const installed = filterEnabled(await fetchInstalledAddons().catch(() => []));
  const merged: Addon[] = [];
  const idxByUrl = new Map<string, number>();
  for (const a of [...stremio, ...installed]) {
    const existing = idxByUrl.get(a.transportUrl);
    if (existing === undefined) {
      idxByUrl.set(a.transportUrl, merged.length);
      merged.push(a);
    } else if (!hasResources(merged[existing]) && hasResources(a)) {
      merged[existing] = a;
    }
  }
  const resolved = await Promise.all(
    merged.map(async (a) => {
      if (hasResources(a)) return a;
      const manifest = await fetchManifestAt(a.transportUrl).catch(() => null);
      return manifest ? { ...a, manifest } : a;
    }),
  );
  const order = loadDisplayOrder();
  const ordered = order.length > 0 ? applyOrderToItems(resolved, order) : resolved;
  const list = withDebridKeys(ordered, {
    rdKey: settings.rdKey,
    tbKey: settings.tbKey,
    adKey: settings.adKey,
    pmKey: settings.pmKey,
    dlKey: settings.dlKey,
  });
  const torbox = torboxAddonFor(settings.tbKey);
  if (torbox) {
    const i = list.findIndex(
      (a) =>
        a.manifest.id === "app.torbox.stremio" || a.transportUrl?.includes("stremio.torbox.app"),
    );
    if (i >= 0) {
      if (list[i].transportUrl !== torbox.transportUrl) list[i] = torbox;
    } else {
      list.push(torbox);
    }
  }
  return list;
}

export async function gatherContext(): Promise<AutoDlContext> {
  const settings = readSettings();
  const debrids = buildDebridClients({
    rdKey: settings.rdKey,
    tbKey: settings.tbKey,
    adKey: settings.adKey,
    pmKey: settings.pmKey,
    dlKey: settings.dlKey,
  });
  const addons = await gatherStreamAddons(readAuthKey(), settings);
  return { settings, debrids, addons };
}
