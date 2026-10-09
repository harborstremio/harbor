import type {
  MediaIdentity,
  MediaServerConnection,
  MediaServerItem,
  MediaServerTitle,
  PlayableCopy,
} from "./types";
import { identityMatches } from "./index-store";
import { episodeSpanContains } from "@/lib/episode-span";

function baseKind(item: MediaServerItem): "movie" | "series" | null {
  if (item.kind === "movie") return "movie";
  if (item.kind === "series" || item.kind === "episode") return "series";
  return null;
}

export function identityKey(identity: MediaIdentity, kind: "movie" | "series"): string | null {
  if (identity.tmdbId != null)
    return `tmdb:${kind === "movie" ? "movie" : "tv"}:${identity.tmdbId}`;
  if (identity.imdbId) return `imdb:${kind}:${identity.imdbId.toLowerCase()}`;
  if (identity.tvdbId != null) return `tvdb:${kind}:${identity.tvdbId}`;
  return null;
}

export function groupMediaServerTitles(items: MediaServerItem[]): MediaServerTitle[] {
  const groups = new Map<string, { title: MediaServerTitle; physical: Set<string> }>();
  const seriesByConnectionAndId = new Map(
    items
      .filter((item) => item.kind === "series")
      .map((item) => [`${item.connectionId}:${item.id}`, item]),
  );
  for (const item of items) {
    const kind = baseKind(item);
    if (!kind || item.kind === "season") continue;
    const parent =
      item.kind === "episode" && item.parentId
        ? seriesByConnectionAndId.get(`${item.connectionId}:${item.parentId}`)
        : undefined;
    if (item.kind === "episode" && !parent && !identityKey(item.identity, kind)) continue;
    const groupIdentity = parent?.identity ?? item.identity;
    const groupTitle = parent?.title ?? item.title;
    const groupYear = parent?.year ?? item.year;
    const identified = identityKey(groupIdentity, kind);
    const fallback = `${kind}:unmatched:${groupTitle.trim().toLowerCase()}:${groupYear ?? ""}`;
    const key = identified ?? fallback;
    let group = groups.get(key);
    if (!group) {
      group = {
        title: {
          key,
          kind,
          identity: { ...groupIdentity, season: undefined, episode: undefined },
          fallbackTitle: groupTitle,
          year: groupYear,
          itemKeys: [],
          connectionIds: [],
          libraryIds: [],
          episodeCount: 0,
          versionCount: 0,
          addedAt: item.addedAt,
          progress: item.progress,
        },
        physical: new Set(),
      };
      groups.set(key, group);
    }
    const itemKey = `${item.connectionId}:${item.id}`;
    group.title.itemKeys.push(itemKey);
    if (!group.title.connectionIds.includes(item.connectionId))
      group.title.connectionIds.push(item.connectionId);
    if (!group.title.libraryIds.includes(item.libraryId))
      group.title.libraryIds.push(item.libraryId);
    if (item.kind === "episode") group.title.episodeCount += 1;
    for (const version of item.versions) group.physical.add(`${itemKey}:${version.id}`);
    group.title.versionCount = group.physical.size;
    group.title.addedAt = Math.max(group.title.addedAt ?? 0, item.addedAt ?? 0) || undefined;
    if ((item.progress?.updatedAt ?? 0) > (group.title.progress?.updatedAt ?? 0))
      group.title.progress = item.progress;
  }
  return [...groups.values()].map((group) => group.title);
}

export function matchingServerItems(
  items: MediaServerItem[],
  identity: MediaIdentity,
  _kind: "movie" | "series",
  season?: number,
  episode?: number,
): MediaServerItem[] {
  const seriesById = new Map(
    items
      .filter((item) => item.kind === "series")
      .map((item) => [`${item.connectionId}:${item.id}`, item]),
  );
  const candidates = items.filter((item) => {
    const parent =
      item.kind === "episode" && item.parentId
        ? seriesById.get(`${item.connectionId}:${item.parentId}`)
        : undefined;
    const candidateIdentity = parent?.identity ?? item.identity;
    if (
      !identityMatches(
        { ...candidateIdentity, season: undefined, episode: undefined },
        { ...identity, season: undefined, episode: undefined },
      )
    )
      return false;
    if (season != null || episode != null) return item.kind === "episode";
    return item.kind === "movie";
  });
  if (season == null || episode == null) return candidates;
  const exact = candidates.filter(
    (item) => item.identity.season === season && item.identity.episode === episode,
  );
  const exactConnections = new Set(exact.map((item) => item.connectionId));
  const selected = candidates.filter((item) => {
    if (exactConnections.has(item.connectionId)) return exact.includes(item);
    return (
      episodeSpanContains(item.identity, season, episode) ||
      item.versions.some((version) => episodeSpanContains(version, season, episode))
    );
  });
  const seen = new Set<string>();
  return selected.flatMap((item) => {
    const isExact = item.identity.season === season && item.identity.episode === episode;
    const versions = item.versions
      .filter((version) => {
        if (isExact && version.episode == null) return true;
        return (
          episodeSpanContains(version, season, episode) ||
          (version.episode == null && episodeSpanContains(item.identity, season, episode))
        );
      })
      .filter((version) => {
        const physical = `${item.connectionId}:${version.filename ?? version.id}`;
        if (seen.has(physical)) return false;
        seen.add(physical);
        return true;
      });
    return versions.length > 0 ? [{ ...item, versions }] : [];
  });
}

export function matchingServerEpisodes(
  items: MediaServerItem[],
  identity: MediaIdentity,
): MediaServerItem[] {
  const seriesById = new Map(
    items
      .filter((item) => item.kind === "series")
      .map((item) => [`${item.connectionId}:${item.id}`, item]),
  );
  return items.filter((item) => {
    if (item.kind !== "episode") return false;
    const candidateIdentity = item.parentId
      ? (seriesById.get(`${item.connectionId}:${item.parentId}`)?.identity ?? item.identity)
      : item.identity;
    return identityMatches(
      { ...candidateIdentity, season: undefined, episode: undefined },
      { ...identity, season: undefined, episode: undefined },
    );
  });
}

/** Collapse server episode records that point at the same physical file. */
export function dedupePhysicalEpisodeItems(items: MediaServerItem[]): MediaServerItem[] {
  const selected = new Map<string, { item: MediaServerItem; score: number }>();
  for (const item of items) {
    const version = item.versions[0];
    const physical = (version?.filename ?? version?.id ?? item.id).toLowerCase();
    const key = `${item.connectionId}:${physical}`;
    const spanSeason = version?.season;
    const spanEpisode = version?.episode;
    const score =
      spanSeason != null &&
      spanEpisode != null &&
      item.identity.season === spanSeason &&
      item.identity.episode === spanEpisode
        ? 1
        : 0;
    const current = selected.get(key);
    if (!current || score > current.score) selected.set(key, { item, score });
  }
  return [...selected.values()].map(({ item }) => item);
}

export function serverPlayableCopies(
  items: MediaServerItem[],
  connections: MediaServerConnection[],
): PlayableCopy[] {
  const byConnection = new Map(connections.map((connection) => [connection.id, connection]));
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const connection = byConnection.get(item.connectionId);
    if (!connection?.enabled) return [];
    return item.versions.flatMap((version) => {
      const physical = `${item.connectionId}:${version.filename ?? version.id}`;
      if (seen.has(physical)) return [];
      seen.add(physical);
      return [
        {
          key: `${item.connectionId}:${item.id}:${version.id}`,
          category: "home-server" as const,
          label: version.name ?? item.title,
          sourceLabel: connection.name,
          version,
          progress: item.progress,
          connectionId: item.connectionId,
          itemId: item.id,
        },
      ];
    });
  });
}
