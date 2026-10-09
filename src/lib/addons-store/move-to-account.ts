import { fetchManifestAt, type InstalledAddon } from "@/lib/addon-store";
import { getUserAddonsRaw, setUserAddonsRaw, type Addon } from "@/lib/addons";
import { hostOf, pushBackup } from "./reorder";

export type MoveStep = "preparing" | "saving" | "verifying";

export type MoveResult =
  | { ok: true; moved: number; skipped: string[] }
  | { ok: false; stage: "fetch" | "write" | "verify"; skipped: string[] };

function displayName(item: InstalledAddon): string {
  return item.manifest?.name ?? hostOf(item.transportUrl);
}

function asCollectionEntry(addon: Addon): Addon {
  return {
    transportUrl: addon.transportUrl,
    transportName: "",
    manifest: addon.manifest,
    flags: { official: false, protected: false },
  } as Addon;
}

export async function moveDeviceAddonsToAccount(
  authKey: string,
  device: InstalledAddon[],
  onStep?: (step: MoveStep) => void,
): Promise<MoveResult> {
  onStep?.("preparing");
  const skipped: string[] = [];
  const prepared: Addon[] = [];
  await Promise.all(
    device.map(async (item) => {
      try {
        const manifest = await fetchManifestAt(item.transportUrl);
        prepared.push({ manifest, transportUrl: item.transportUrl });
      } catch {
        if (item.manifest) prepared.push({ manifest: item.manifest, transportUrl: item.transportUrl });
        else skipped.push(displayName(item));
      }
    }),
  );
  const cloud = await getUserAddonsRaw(authKey);
  if (cloud == null) return { ok: false, stage: "fetch", skipped };
  const have = new Set(cloud.map((a) => a.transportUrl));
  const additions: Addon[] = [];
  for (const a of prepared) {
    if (have.has(a.transportUrl)) continue;
    have.add(a.transportUrl);
    additions.push(a);
  }
  if (additions.length === 0) return { ok: true, moved: 0, skipped };
  pushBackup(cloud);
  onStep?.("saving");
  const wrote = await setUserAddonsRaw(authKey, [...cloud, ...additions.map(asCollectionEntry)]);
  if (!wrote) return { ok: false, stage: "write", skipped };
  onStep?.("verifying");
  const readBack = await getUserAddonsRaw(authKey);
  const confirmed =
    readBack != null &&
    additions.every((a) => readBack.some((r) => r.transportUrl === a.transportUrl));
  if (!confirmed) return { ok: false, stage: "verify", skipped };
  return { ok: true, moved: additions.length, skipped };
}
