import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { narrowMediaType, type Meta } from "@/lib/cinemeta";
import { resolveMeta } from "@/lib/meta-resource";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";

type PreferredResult = {
  key: string;
  meta: Meta | null;
};

const preferredCache = new Map<string, Meta>();
const preferredInflight = new Map<string, Promise<Meta | null>>();
let cacheScope = "";

const PREFERRED_META_CONCURRENCY = 3;
let preferredActive = 0;
const preferredQueue: Array<() => void> = [];

function runPreferredQueued<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      preferredActive += 1;
      void task()
        .then(resolve, reject)
        .finally(() => {
          preferredActive -= 1;
          preferredQueue.shift()?.();
        });
    };

    if (preferredActive < PREFERRED_META_CONCURRENCY) start();
    else preferredQueue.push(start);
  });
}

function retryDelay(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 750));
}

async function loadPreferredMeta(
  authKey: string | null,
  meta: Meta,
  tmdbKey: string,
): Promise<Meta | null> {
  const scope = authKey ?? "local";
  if (scope !== cacheScope) {
    cacheScope = scope;
    preferredCache.clear();
    preferredInflight.clear();
  }

  const cacheKey = `${scope}:${meta.type}:${meta.id}:${tmdbKey ? "mapped" : "direct"}`;
  const cached = preferredCache.get(cacheKey);
  if (cached) return cached;
  const pending = preferredInflight.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    let metadataId = meta.id;
    if (meta.id.startsWith("tmdb:") && tmdbKey) {
      metadataId = (await tmdbImdbId(tmdbKey, meta.id).catch(() => null)) ?? meta.id;
    }

    const resolved = await runPreferredQueued(() =>
      resolveMeta(authKey, narrowMediaType(meta.type), metadataId).catch(() => null),
    );
    const preferred = resolved?.addonOrigin ? resolved : null;
    if (preferred) preferredCache.set(cacheKey, preferred);
    return preferred;
  })().finally(() => preferredInflight.delete(cacheKey));

  preferredInflight.set(cacheKey, request);
  return request;
}

/**
 * Resolve the first installed metadata addon for a title when the user opted
 * into custom metadata. Cinemeta fallbacks returned by resolveMeta are ignored
 * here so detail enrichers cannot accidentally be treated as the preferred
 * addon.
 */
export function usePreferredMeta(meta: Meta, enabled = true): Meta | null {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const key = `${meta.type}:${meta.id}`;
  const [result, setResult] = useState<PreferredResult | null>(null);

  useEffect(() => {
    let alive = true;

    if (!settings.preferCustomMetaAddon || !enabled) {
      setResult({ key, meta: null });
      return () => {
        alive = false;
      };
    }

    setResult({ key, meta: null });
    void (async () => {
      let resolved = await loadPreferredMeta(authKey, meta, settings.tmdbKey);
      if (!resolved && alive) {
        await retryDelay();
        if (!alive) return;
        resolved = await loadPreferredMeta(authKey, meta, settings.tmdbKey);
      }
      if (!alive) return;
      setResult({ key, meta: resolved });
    })();

    return () => {
      alive = false;
    };
  }, [authKey, enabled, key, meta.id, meta.type, settings.preferCustomMetaAddon, settings.tmdbKey]);

  if (!settings.preferCustomMetaAddon || !enabled || result?.key !== key) return null;
  return result.meta;
}
