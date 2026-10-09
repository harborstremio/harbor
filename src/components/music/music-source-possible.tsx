import { useEffect, useState } from "react";
import { Music2, Play } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { searchTyped } from "@/lib/music/catalog";
import { musicHealthSnapshot } from "@/lib/music/sources";
import { musicSourceName } from "@/lib/music/recovery";
import type { MusicTrack } from "@/lib/music/types";
import { MusicServiceLogo } from "./music-service-logo";

const LANE_LIMIT = 6;
const SHOWN = 8;

type PossibleState = { searching: boolean; tracks: MusicTrack[] };

function possibleKey(track: MusicTrack): string {
  return `${track.connectorId ?? ""}:${track.sourceId ?? track.id}`;
}

async function unmatchedSources(covered: string): Promise<string[]> {
  const listed = new Set(covered.split(",").filter(Boolean));
  const health = await musicHealthSnapshot().catch(() => []);
  return health
    .filter((entry) => entry.searchable && entry.playable && entry.health !== "offline")
    .filter((entry) => !listed.has(entry.id))
    .map((entry) => entry.id);
}

async function searchSources(track: MusicTrack, ids: string[]): Promise<MusicTrack[]> {
  const query = `${track.artist.trim()} ${track.title.trim()}`.trim();
  if (!query) return [];
  const lanes = await Promise.all(
    ids.map(async (id) => {
      try {
        const results = await searchTyped(query, LANE_LIMIT, id);
        return results.tracks.map((found) => ({
          ...found,
          connectorId: found.connectorId ?? id,
        })) as MusicTrack[];
      } catch {
        return [] as MusicTrack[];
      }
    }),
  );
  const taken = new Set([possibleKey(track)]);
  const picked: MusicTrack[] = [];
  const deepest = lanes.reduce((most, lane) => Math.max(most, lane.length), 0);
  for (let depth = 0; depth < deepest && picked.length < SHOWN; depth += 1) {
    for (const lane of lanes) {
      const found = lane[depth];
      if (!found || picked.length >= SHOWN) continue;
      const key = possibleKey(found);
      if (taken.has(key)) continue;
      taken.add(key);
      picked.push(found);
    }
  }
  return picked;
}

export function MusicSourcePossible({
  track,
  covered,
  onPick,
}: {
  track: MusicTrack;
  covered: string;
  onPick: (found: MusicTrack) => void;
}) {
  const t = useT();
  const [state, setState] = useState<PossibleState | null>(null);
  const trackKey = possibleKey(track);
  const onlyOriginal = covered.split(",").filter(Boolean).length <= 1;

  useEffect(() => {
    let live = true;
    setState(null);
    const run = async () => {
      const ids = await unmatchedSources(covered);
      if (!live || ids.length === 0) return;
      setState({ searching: true, tracks: [] });
      const tracks = await searchSources(track, ids).catch(() => [] as MusicTrack[]);
      if (live) setState({ searching: false, tracks });
    };
    void run().catch(() => {});
    return () => {
      live = false;
    };
  }, [trackKey, covered]);

  if (!state) return null;
  if (!onlyOriginal && (state.searching || state.tracks.length === 0)) return null;

  return (
    <section
      className="mt-2 border-t border-edge-soft px-2 pt-4"
      aria-label={t("music.source.possible.title")}
    >
      <h3 className="px-2 text-[13px] font-semibold text-ink">
        {t("music.source.possible.title")}
      </h3>
      <p className="mt-1 px-2 text-[11px] leading-relaxed text-ink-muted">
        {t("music.source.possible.note")}
      </p>
      {state.searching ? (
        <div
          role="status"
          aria-label={t("music.source.possible.loading")}
          className="mt-2 grid gap-px pb-2"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              aria-hidden="true"
              className="grid min-h-16 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2"
            >
              <span className="size-11 animate-pulse rounded-md bg-raised" />
              <span className="min-w-0">
                <span
                  className="block h-[13px] animate-pulse rounded bg-elevated/60"
                  style={{ width: `${68 - item * 9}%` }}
                />
                <span
                  className="mt-1 block h-[11px] animate-pulse rounded bg-elevated/45"
                  style={{ width: `${44 - item * 7}%` }}
                />
                <span
                  className="mt-1.5 block h-[10px] animate-pulse rounded bg-elevated/35"
                  style={{ width: `${30 - item * 4}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      ) : state.tracks.length === 0 ? (
        <p className="grid min-h-20 place-items-center px-4 text-center text-[11px] text-ink-muted">
          {t("music.source.possible.empty")}
        </p>
      ) : (
        <div className="mt-2 grid gap-px pb-2">
          {state.tracks.map((found) => (
            <button
              key={possibleKey(found)}
              type="button"
              onClick={() => onPick(found)}
              className="group grid min-h-16 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-start transition-colors hover:bg-elevated"
            >
              <span className="grid size-11 place-items-center overflow-hidden rounded-md bg-raised text-ink-muted">
                {found.artwork ? (
                  <img src={found.artwork} alt="" className="size-full object-cover" />
                ) : (
                  <Music2 size={18} aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[13px] font-semibold text-ink">
                  {found.title}
                </strong>
                <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                  {found.artist}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-subtle">
                  <MusicServiceLogo
                    source={found.connectorId ?? ""}
                    itemId={found.id}
                    size={12}
                    fallback={<Music2 size={12} aria-hidden="true" />}
                  />
                  <span className="truncate">
                    {found.durationLabel
                      ? `${musicSourceName(found)} · ${found.durationLabel}`
                      : musicSourceName(found)}
                  </span>
                </span>
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-ink text-canvas transition-transform group-hover:scale-105">
                <Play size={13} fill="currentColor" />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
