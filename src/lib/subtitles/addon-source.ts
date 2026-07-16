import { userAddons, type Addon } from "@/lib/addons";
import { fetchManifestAt, loadInstalled } from "@/lib/addon-store";
import { dlog } from "@/lib/debug";
import { SUBTITLE_PROVIDER_TIMEOUT_MS, withSubtitleTimeout } from "./autoload";

function hasSubtitleResource(a: Addon): boolean {
  const resources = a.manifest?.resources ?? [];
  const hasSubtitles = resources.some((r) =>
    typeof r === "string" ? r === "subtitles" : r.name === "subtitles",
  );

  if (!hasSubtitles) {
    dlog(
      `[addon-source] ${a.manifest.name} does NOT have subtitle resource. Resources: ${JSON.stringify(resources.map((r) => (typeof r === "string" ? r : r.name)))}`,
    );
  }

  return hasSubtitles;
}

export async function gatherSubtitleAddons(authKey: string | null): Promise<Addon[]> {
  dlog(`[addon-source] === GATHERING SUBTITLE ADDONS ===`);
  dlog(`[addon-source] Auth key present: ${!!authKey}`);

  const cloud = authKey
    ? await withSubtitleTimeout(userAddons(authKey), SUBTITLE_PROVIDER_TIMEOUT_MS, []).catch(
        (e) => {
          dlog(`[addon-source] Failed to fetch cloud addons: ${e}`);
          return [] as Addon[];
        },
      )
    : [];
  dlog(`[addon-source] Cloud addons: ${cloud.length}`);
  if (cloud.length > 0) {
    dlog(`[addon-source] Cloud addon names: ${cloud.map((a) => a.manifest.name).join(", ")}`);
  }

  const localInstalled = loadInstalled();
  dlog(`[addon-source] Total local installed addons: ${localInstalled.length}`);
  if (localInstalled.length > 0) {
    dlog(
      `[addon-source] Local installed names: ${localInstalled.map((l) => l.manifest?.name || "no-name").join(", ")}`,
    );
  }

  const seen = new Set(cloud.map((a) => a.transportUrl));
  const localOnly = localInstalled.filter((l) => !seen.has(l.transportUrl));
  dlog(`[addon-source] Local addons (not in cloud): ${localOnly.length}`);

  const localFull = await withSubtitleTimeout(
    Promise.all(
      localOnly.map(async (l): Promise<Addon | null> => {
        if (l.manifest) return { manifest: l.manifest, transportUrl: l.transportUrl };
        const manifest = await fetchManifestAt(l.transportUrl).catch(() => null);
        return manifest ? { manifest, transportUrl: l.transportUrl } : null;
      }),
    ),
    SUBTITLE_PROVIDER_TIMEOUT_MS,
    [] as Array<Addon | null>,
  );

  const merged = [...cloud, ...localFull.filter((a): a is Addon => a != null)];
  dlog(`[addon-source] Total merged addons (before subtitle filter): ${merged.length}`);

  // Check each addon for subtitle resource
  const withSubtitles = merged.filter(hasSubtitleResource);
  dlog(`[addon-source] === RESULT: ${withSubtitles.length} addons with subtitle resource ===`);
  if (withSubtitles.length > 0) {
    dlog(
      `[addon-source] Subtitle addon names: ${withSubtitles.map((a) => a.manifest.name).join(", ")}`,
    );
  }

  return withSubtitles;
}
