import { useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { useSettings } from "@/lib/settings";
import { cfbdSeason, createCfbdClient, type CfbdRankings } from "./cfbd";
import { useVisionVersion, vision } from "./vision";
import { linkVisionToCfbd } from "./vision-cfbd-link";

/** The app's CollegeFootballData client (cfbd.ts), cached in this device's storage. */
export const cfbd = createCfbdClient({
  fetch: (url, init) => safeFetch(url, init),
  storage: {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* private mode or full: the in-memory copy still serves this session */
      }
    },
  },
});

/** The viewer's CFBD key, or "" when they haven't added one. */
export function useCfbdKey(): string {
  const { settings } = useSettings();
  return settings.cfbdKey.trim();
}

/**
 * This season's latest polls; null while loading, without a key, or when CFBD can't answer.
 * `ready` is false only while a request with a key is outstanding.
 */
export function useCfbdRankings(): {
  rankings: CfbdRankings | null;
  ready: boolean;
  hasKey: boolean;
} {
  const key = useCfbdKey();
  const [state, setState] = useState<{ key: string; rankings: CfbdRankings | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let active = true;
    void cfbd.rankings(key, cfbdSeason(new Date())).then((rankings) => {
      if (active) setState({ key, rankings });
    });
    return () => {
      active = false;
    };
  }, [key]);
  const current = key && state?.key === key ? state : null;
  return { rankings: current?.rankings ?? null, ready: !key || !!current, hasKey: !!key };
}

/**
 * With a CFBD key, links JL Vision's college teams that the database hasn't linked yet, so their
 * branding, art and team pages work without anyone editing the database (vision-cfbd-link.ts).
 */
export function useCfbdVisionLinks(): void {
  const key = useCfbdKey();
  const version = useVisionVersion();
  useEffect(() => {
    if (!key) return;
    let active = true;
    void cfbd.teams(key).then((teams) => {
      const visionTeams = vision.teams();
      if (active && teams?.length && visionTeams.length)
        vision.setDeviceLinks(linkVisionToCfbd(visionTeams, teams));
    });
    return () => {
      active = false;
    };
  }, [key, version]);
}
