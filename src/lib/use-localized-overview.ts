import { useEffect, useState } from "react";
import { narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useAuth } from "@/lib/auth";
import { resolveMeta } from "@/lib/meta-resource";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import { tmdbMetadataOverview } from "@/lib/providers/tmdb/tmdb-lite";
import { useSettings } from "@/lib/settings";

export function useLocalizedOverview(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const isTmdb = meta.id.startsWith("tmdb:");
  const [overview, setOverview] = useState<string | undefined>(
    isTmdb ? undefined : meta.description,
  );

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (settings.preferCustomMetaAddon) {
        let metadataId = meta.id;
        if (isTmdb && settings.tmdbKey) {
          metadataId = (await tmdbImdbId(settings.tmdbKey, meta.id).catch(() => null)) ?? meta.id;
        }

        const custom = await resolveMeta(authKey, narrowMediaType(meta.type), metadataId).catch(
          () => null,
        );

        if (!alive) return;
        if (custom?.addonOrigin && custom.description) {
          setOverview(custom.description);
          return;
        }
      }

      if (!isTmdb || !settings.tmdbKey) {
        setOverview(meta.description);
        return;
      }

      setOverview(undefined);
      const localized = await tmdbMetadataOverview(settings.tmdbKey, meta.id).catch(() => null);
      if (alive) setOverview(localized ?? meta.description);
    };

    void load();
    return () => {
      alive = false;
    };
  }, [
    authKey,
    isTmdb,
    meta.description,
    meta.id,
    meta.type,
    settings.preferCustomMetaAddon,
    settings.tmdbKey,
  ]);

  return overview;
}
