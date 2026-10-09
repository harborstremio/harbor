import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gatherCatalogAddons, type Addon } from "@/lib/addons";
import { isAddonEnabled } from "@/lib/addon-store";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/profiles";
import type { SportsGame } from "@/lib/sports/espn-types";
import {
  clearSportsAddonCatalogCache,
  loadSportsAddonListings,
  refreshSportsAddonManifests,
} from "@/lib/sports/addon-sources";
import { sportsAddonCatalogs, type SportsAddonListing } from "@/lib/sports/addon-sources-model";
import { useSportsConsent } from "@/views/sports/access-gate";

export type BpSportsAddonSources = {
  rows: SportsAddonListing[];
  matching: SportsAddonListing[];
  loading: boolean;
  failed: boolean;
  installed: boolean;
  available: boolean;
  matched: boolean;
  enabledProviders: () => Addon[];
  reload: () => void;
  hardReload: () => void;
};

export function useBpSportsAddonSources(game: SportsGame): BpSportsAddonSources {
  const consent = useSportsConsent();
  const { authKey } = useAuth();
  const { activeId } = useProfiles();
  const [rows, setRows] = useState<SportsAddonListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [tick, setTick] = useState(0);
  const providers = useRef<Addon[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;

  const active = consent.status === "accepted" && game.state !== "post";
  const identity = JSON.stringify([
    game.startMs,
    game.home.name,
    game.away.name,
    game.context?.name,
    game.broadcasts,
  ]);

  useEffect(() => {
    if (!active) {
      providers.current = [];
      setRows([]);
      setLoading(false);
      setFailed(false);
      setInstalled(false);
      return;
    }
    const controller = new AbortController();
    setRows([]);
    setLoading(true);
    setFailed(false);
    setInstalled(false);
    void (async () => {
      const gathered = await gatherCatalogAddons(authKey);
      if (controller.signal.aborted) return;
      const hydrated = await refreshSportsAddonManifests(gathered, controller.signal);
      if (controller.signal.aborted) return;
      providers.current = hydrated.addons;
      const eligible = hydrated.addons.filter((addon) => sportsAddonCatalogs(addon).length > 0);
      setInstalled(eligible.length > 0);
      const result = await loadSportsAddonListings(
        eligible,
        gameRef.current,
        controller.signal,
        (partial) => {
          if (!controller.signal.aborted) setRows(partial);
        },
      );
      if (controller.signal.aborted) return;
      setRows(result.rows);
      setFailed(result.failed > 0 || hydrated.failed > 0);
    })()
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, authKey, activeId, identity, tick]);

  const matching = useMemo(() => rows.filter((row) => row.match !== null), [rows]);

  const enabledProviders = useCallback(
    () => providers.current.filter((addon) => isAddonEnabled(addon.transportUrl)),
    [],
  );

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const hardReload = useCallback(() => {
    clearSportsAddonCatalogCache();
    setTick((n) => n + 1);
  }, []);

  return {
    rows,
    matching,
    loading: active && loading,
    failed,
    installed,
    available: active && rows.length > 0,
    matched: active && matching.length > 0,
    enabledProviders,
    reload,
    hardReload,
  };
}
