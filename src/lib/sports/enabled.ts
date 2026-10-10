import { usePlaylists, type StoredPlaylist } from "@/lib/iptv/playlists-store";
import { useSettings } from "@/lib/settings";
import { useSyncExternalStore } from "react";
import {
  getSportsConsentSnapshot,
  getSportsConsentServerSnapshot,
  subscribeSportsConsent,
} from "./consent";
export function hasSportsSource(sources: readonly StoredPlaylist[]) {
  return sources.some(
    (source) =>
      source.kind !== "epg" &&
      Boolean(
        source.url.trim() ||
        (source.kind === "xtream" &&
          source.xtream?.server &&
          source.xtream.username &&
          source.xtream.password),
      ),
  );
}
export function useSportsEnabled() {
  const sources = usePlaylists();
  const { settings } = useSettings();
  const consent = useSyncExternalStore(
    subscribeSportsConsent,
    getSportsConsentSnapshot,
    getSportsConsentServerSnapshot,
  );
  const reachable = hasSportsSource(sources) || settings.sportsWithoutProvider === true;
  return reachable && consent.status !== "declined";
}
