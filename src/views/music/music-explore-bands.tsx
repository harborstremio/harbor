import { useCallback, useEffect, useMemo, useState } from "react";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { useT } from "@/lib/i18n";
import { searchTyped } from "@/lib/music/catalog";
import {
  artistTally,
  dayPart,
  forgottenFavourites,
  normalizeArtist,
  seasonalMoment,
  type HabitMoment,
} from "@/lib/music/listening-habits";
import { readArtistGenres } from "@/lib/music/artist-genre-cache";
import { genreMatchesTags } from "@/lib/music/genre-membership";
import { genreSearchKey } from "@/lib/music/genre-catalog";
import type { MusicDiscoveryGenre } from "@/lib/music/genre-catalog";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { localRow, trackItem } from "./music-band-types";

type Props = {
  recents: MusicTrack[];
  liked: MusicTrack[];
  active: boolean;
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  /** On a genre page every row is scoped to that genre, and empty rows are dropped. */
  genre?: MusicDiscoveryGenre | null;
};

function useMomentTracks(moment: HabitMoment | null, active: boolean) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const key = moment?.id ?? "";
  useEffect(() => {
    if (!moment || !active) return;
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      const lanes = await Promise.all(
        moment.queries.map((query) => searchTyped(query, 12).catch(() => null)),
      );
      if (cancelled) return;
      const seen = new Set<string>();
      const out: MusicTrack[] = [];
      for (const lane of lanes) {
        for (const track of lane?.tracks ?? []) {
          const id = `${track.connectorId}:${track.id}`;
          if (seen.has(id)) continue;
          seen.add(id);
          out.push(track);
        }
      }
      setTracks(out.slice(0, 18));
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [key, active]);
  return { tracks, status };
}

function HabitRow({
  id,
  title,
  subtitle,
  tracks,
  status,
  onPlay,
  onOpen,
}: {
  id: string;
  title: string;
  subtitle: string;
  tracks: MusicTrack[];
  status: "loading" | "ready";
  onPlay: Props["onPlay"];
  onOpen: Props["onOpen"];
}) {
  const items = useMemo(() => tracks.map(trackItem), [tracks]);
  if (status === "ready" && tracks.length === 0) return null;
  return (
    <MusicCatalogRow
      row={localRow(id, title, subtitle, "trackGrid", items)}
      status={status}
      count={9}
      onPlay={(_item, index) => {
        const track = tracks[index];
        if (track) onPlay(track, tracks);
      }}
      onOpen={(item) => onOpen(item, items)}
    />
  );
}

export function MusicExploreBands({ recents, liked, active, onPlay, onOpen, genre }: Props) {
  const t = useT();
  const now = useMemo(() => new Date(), [active]);
  const season = useMemo(() => seasonalMoment(now), [now]);
  const part = useMemo(() => dayPart(now), [now]);
  const seasonTracks = useMomentTracks(season, active);
  const partTracks = useMomentTracks(part, active);

  const onRepeat = useMemo(() => {
    const ranked = artistTally(recents);
    if (ranked.length === 0) return [];
    const order = new Map(ranked.map((entry, index) => [normalizeArtist(entry.name), index]));
    return recents
      .filter((track) => order.has(normalizeArtist(track.artist ?? "")))
      .sort(
        (a, b) =>
          (order.get(normalizeArtist(a.artist ?? "")) ?? 0) -
          (order.get(normalizeArtist(b.artist ?? "")) ?? 0),
      )
      .slice(0, 18);
  }, [recents]);

  const forgotten = useMemo(() => forgottenFavourites(liked, recents), [liked, recents]);

  // On a genre page every row belongs to that genre, filtered by the artist's cached tags.
  // A row left with nothing is dropped instead of rendering empty.
  const [tags, setTags] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  useEffect(() => {
    if (!genre) return;
    let live = true;
    void readArtistGenres().then((value) => { if (live) setTags(value); });
    return () => { live = false; };
  }, [genre]);
  const scoped = useCallback(
    (list: readonly MusicTrack[]) =>
      genre
        ? list.filter((track) =>
            genreMatchesTags(genre, tags.get(genreSearchKey(track.artist ?? "")) ?? []))
        : [...list],
    [genre, tags],
  );
  const seasonList = useMemo(() => scoped(seasonTracks.tracks), [scoped, seasonTracks.tracks]);
  const partList = useMemo(() => scoped(partTracks.tracks), [scoped, partTracks.tracks]);
  const repeatList = useMemo(() => scoped(onRepeat), [scoped, onRepeat]);
  const forgottenList = useMemo(() => scoped(forgotten), [scoped, forgotten]);

  return (
    <>
      {season && (seasonTracks.status === "loading" || seasonList.length > 0) && (
        <HabitRow
          id={`habit-season-${season.id}`}
          title={t(season.titleKey)}
          subtitle={t(season.subtitleKey)}
          tracks={seasonList}
          status={seasonTracks.status}
          onPlay={onPlay}
          onOpen={onOpen}
        />
      )}
      <HabitRow
        id={`habit-daypart-${part.id}`}
        title={t(part.titleKey)}
        subtitle={t(part.subtitleKey)}
        tracks={partList}
        status={partTracks.status}
        onPlay={onPlay}
        onOpen={onOpen}
      />
      {repeatList.length > 2 && (
        <HabitRow
          id="habit-on-repeat"
          title={t("music.habit.onRepeat")}
          subtitle={t("music.habit.onRepeat.subtitle")}
          tracks={repeatList}
          status="ready"
          onPlay={onPlay}
          onOpen={onOpen}
        />
      )}
      {forgottenList.length > 2 && (
        <HabitRow
          id="habit-forgotten"
          title={t("music.habit.forgotten")}
          subtitle={t("music.habit.forgotten.subtitle")}
          tracks={forgottenList}
          status="ready"
          onPlay={onPlay}
          onOpen={onOpen}
        />
      )}
    </>
  );
}
