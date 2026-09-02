import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useMal } from "@/lib/mal/provider";
import { fetchMalList } from "@/lib/mal/lists";
import type { MalListEntry, MalListGroup, MalListStatus } from "@/lib/mal/types";

export type MalRail = { key: string; title: string; metas: Meta[] };

const RAIL_ORDER: Array<{ key: string; title: string; statuses: MalListStatus[] }> = [
  { key: "watching", title: "Watching", statuses: ["watching"] },
  { key: "planning", title: "Plan to Watch", statuses: ["plan_to_watch"] },
  { key: "completed", title: "Completed", statuses: ["completed"] },
  { key: "onhold", title: "On Hold", statuses: ["on_hold"] },
  { key: "dropped", title: "Dropped", statuses: ["dropped"] },
];

const MIN_PER_RAIL = 1;

function malEntryToMeta(entry: MalListEntry): Meta | null {
  const name = entry.anime.title;
  if (!name) return null;
  return {
    id: `mal:${entry.anime.id}`,
    type: "series",
    name,
    poster: entry.anime.mainPicture ?? undefined,
    releaseInfo: undefined,
    imdbRating: entry.anime.mean != null ? entry.anime.mean.toFixed(1) : undefined,
  };
}

export type MalRailsState = { rails: MalRail[]; loading: boolean; error: boolean };

const IDLE: MalRailsState = { rails: [], loading: false, error: false };

export function useMalAnimeRails(): MalRail[] {
  return useMalAnimeRailsState().rails;
}

export function useMalAnimeRailsState(): MalRailsState {
  const { isConnected } = useMal();
  const [state, setState] = useState<MalRailsState>(IDLE);

  useEffect(() => {
    if (!isConnected) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    setState({ rails: [], loading: true, error: false });
    (async () => {
      let groups: MalListGroup[];
      try {
        groups = await fetchMalList();
      } catch (e) {
        console.error("Failed to fetch MAL list", e);
        if (!cancelled) setState({ rails: [], loading: false, error: true });
        return;
      }
      if (cancelled) return;
      const entriesByStatus = new Map(groups.map((g) => [g.status, g.entries]));

      const out: MalRail[] = [];
      for (const rail of RAIL_ORDER) {
        let entries = rail.statuses.flatMap((s) => entriesByStatus.get(s) ?? []);
        if (rail.key === "watching" || rail.key === "completed") {
          entries = [...entries].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        }
        const metas = entries.map(malEntryToMeta).filter((m): m is Meta => m != null);
        if (metas.length >= MIN_PER_RAIL) out.push({ key: rail.key, title: rail.title, metas });
      }

      if (!cancelled) setState({ rails: out, loading: false, error: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  return state;
}
