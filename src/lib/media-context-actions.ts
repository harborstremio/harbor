import { meta as fetchMeta, type Meta } from "./cinemeta";
import { airedOnly } from "./aired";
import { t } from "./i18n";
import { captureMembershipProfile } from "./membership-operations";
import { readActiveStremioAuthKey } from "./auth";
import { ANIME_CLOUD_ID } from "./stremio";
import {
  setLocalWatchlistAcknowledged,
  clearWatchlistAggregate,
  type WatchlistInput,
} from "./watchlist";
import { setMediaFavoriteSafely, type MediaInput } from "./media-favorites";
import { setMovieWatchedLocalAcknowledged } from "./movie-watched";
import { setWatchedFlagAcknowledged } from "./watched-flag";
import { setManualWatchedManyAcknowledged, recordManualWatchedMeta } from "./manual-watched";
import { savePlayback } from "./playback-history";
import { recordWatchEvent } from "./watch-events";
import {
  watchlistProviderWrites,
  watchedProviderWrites,
  type ProviderWrite,
} from "./media-provider-actions";

export type MediaActionResult = {
  noChanges?: boolean;
  outcomes: Array<{
    provider: string;
    status: "updated" | "failed" | "unsupported";
    reason?: string;
  }>;
};
export type WatchedEpisode = { season: number; episode: number };
export type UnsafeProviderPolicy = "skip" | "block";
const pending = new Set<string>();

function captureAction() {
  const profile = captureMembershipProfile();
  const authKey = readActiveStremioAuthKey();
  if (!profile) throw new Error("The active profile could not be read.");
  return {
    profile,
    assertCurrent: () => {
      const current = captureMembershipProfile();
      if (
        !current ||
        current.activeId !== profile.activeId ||
        current.settingsLinked !== profile.settingsLinked ||
        readActiveStremioAuthKey() !== authKey
      )
        throw new Error("The active profile changed. Open the menu again.");
    },
  };
}

async function perform(
  key: string,
  local: () => void | Promise<void>,
  providers: ProviderWrite[],
  assertCurrent: () => void,
  unsafeProviderPolicy: UnsafeProviderPolicy = "skip",
): Promise<MediaActionResult> {
  if (pending.has(key)) throw new Error("This title is already being updated.");
  pending.add(key);
  const result: MediaActionResult = { outcomes: [] };
  try {
    if (unsafeProviderPolicy === "block") {
      for (const write of providers) {
        try {
          assertCurrent();
          const reason = await write.preflight?.(assertCurrent);
          if (reason) {
            result.noChanges = true;
            result.outcomes.push({
              provider: write.provider,
              status: "unsupported",
              reason,
            });
            return result;
          }
        } catch {
          result.outcomes.push({
            provider: write.provider,
            status: "failed",
            reason: "The provider's current state could not be checked. No changes were made.",
          });
          return result;
        }
      }
    }
    try {
      assertCurrent();
      await local();
      result.outcomes.push({ provider: "Harbor", status: "updated" });
    } catch {
      result.outcomes.push({
        provider: "Harbor",
        status: "failed",
        reason: "Local changes could not be fully saved.",
      });
      return result;
    }
    for (const write of providers) {
      try {
        assertCurrent();
        const unavailable = await write.run(assertCurrent);
        result.outcomes.push(
          unavailable
            ? { provider: write.provider, status: "unsupported", reason: unavailable }
            : { provider: write.provider, status: "updated" },
        );
      } catch {
        result.outcomes.push({
          provider: write.provider,
          status: "failed",
          reason: "The provider did not confirm this change. Any completed changes were kept.",
        });
      }
    }
    return result;
  } finally {
    pending.delete(key);
  }
}

export function requireMediaActionSuccess(
  result: MediaActionResult,
  translate: typeof t = t,
): void {
  if (result.outcomes.every((outcome) => outcome.status === "updated")) return;
  const confirmed = result.outcomes
    .filter((o) => o.status === "updated")
    .map((o) => translate(o.provider));
  const failures = result.outcomes
    .filter((o) => o.status !== "updated")
    .map((o) =>
      translate("{provider}: {reason}", {
        provider: translate(o.provider),
        reason: translate(o.reason ?? "The action could not be completed."),
      }),
    );
  const lines = [
    ...(result.noChanges ? [translate("No changes were made.")] : []),
    ...(confirmed.length
      ? [translate("Updated: {providers}.", { providers: confirmed.join(", ") })]
      : []),
    ...failures,
  ];
  throw new Error(lines.join("\n"));
}

export async function setContextWatchlist(
  input: WatchlistInput,
  on: boolean,
  unsafeProviderPolicy: UnsafeProviderPolicy = "skip",
): Promise<MediaActionResult> {
  const { assertCurrent } = captureAction();
  const result = await perform(
    `watchlist:${input.id}`,
    () => setLocalWatchlistAcknowledged(input, on),
    watchlistProviderWrites(input, on),
    assertCurrent,
    unsafeProviderPolicy,
  );
  if (!on && result.outcomes.every((o) => o.status === "updated")) {
    try {
      assertCurrent();
      clearWatchlistAggregate(input);
    } catch {
      result.outcomes.push({
        provider: "Harbor watchlist cache",
        status: "failed",
        reason: "The saved watchlist view could not be updated.",
      });
    }
  }
  return result;
}

export async function setContextFavorite(
  input: MediaInput,
  on: boolean,
): Promise<MediaActionResult> {
  const { profile, assertCurrent } = captureAction();
  return perform(
    `favorite:${input.id}`,
    () => {
      const saved = setMediaFavoriteSafely(profile, input, on);
      if (saved.status === "error") throw new Error(saved.reason);
    },
    [],
    assertCurrent,
  );
}

export async function setContextWatched(
  meta: Meta,
  watched: boolean,
  options: {
    imdbId?: string | null;
    episode?: WatchedEpisode;
    providerEpisode?: WatchedEpisode;
    episodes?: WatchedEpisode[];
    syncMetaId?: string;
    onUnsafeProvider?: UnsafeProviderPolicy;
  } = {},
): Promise<MediaActionResult> {
  const { assertCurrent } = captureAction();
  const isMovie = meta.type === "movie";
  const nativeAnime = ANIME_CLOUD_ID.test(meta.id) || meta.type === "anime";
  if (!isMovie && meta.type !== "series" && meta.type !== "anime")
    throw new Error("Watched actions are not available for this content type.");
  if (isMovie && (options.episode || options.episodes))
    throw new Error("A movie cannot have an episode watched action.");
  if (options.episode && options.episodes) throw new Error("Choose one explicit episode scope.");
  if (options.providerEpisode && (!options.episode || !options.imdbId))
    throw new Error("The provider episode needs a verified title identity.");
  if (
    options.providerEpisode &&
    (!Number.isInteger(options.providerEpisode.season) ||
      options.providerEpisode.season < 0 ||
      !Number.isInteger(options.providerEpisode.episode) ||
      options.providerEpisode.episode < 1)
  )
    throw new Error("The provider episode identity is invalid.");
  let videos = meta.videos;
  let episodes: WatchedEpisode[] = [];
  if (!isMovie) {
    if (options.episode || options.episodes) {
      const selected = options.episode ? [options.episode] : options.episodes!;
      if (
        !selected.length ||
        selected.some(
          ({ season, episode }) =>
            !Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1,
        )
      )
        throw new Error("The episode identity is invalid.");
      episodes = [
        ...new Map(
          selected.map((ep) => [
            `${ep.season}:${ep.episode}`,
            { season: ep.season, episode: ep.episode },
          ]),
        ).values(),
      ];
    } else {
      if (!videos?.length)
        videos = (await fetchMeta("series", nativeAnime ? meta.id : options.imdbId || meta.id))
          ?.videos;
      assertCurrent();
      if (!videos?.length)
        throw new Error("Episode information is unavailable. No watched state was changed.");
      const ordered = videos
        .flatMap((v) => {
          const season = v.season ?? (meta.type === "anime" ? 1 : 0);
          const episode = v.episode ?? v.number;
          return Number.isInteger(season) &&
            season >= 1 &&
            Number.isInteger(episode) &&
            episode! >= 1
            ? [{ season, episode: episode!, released: v.released ?? v.firstAired ?? null }]
            : [];
        })
        .sort((a, b) => a.season - b.season || a.episode - b.episode);
      episodes = [
        ...new Map(
          airedOnly(ordered, (v) => v.released).map(({ season, episode }) => [
            `${season}:${episode}`,
            { season, episode },
          ]),
        ).values(),
      ];
      if (!episodes.length)
        throw new Error("No released episodes are available. No watched state was changed.");
    }
  }
  return perform(
    `watched:${meta.id}`,
    () => {
      if (isMovie) {
        setMovieWatchedLocalAcknowledged(meta.id, watched);
        setWatchedFlagAcknowledged(meta.id, watched);
        if (!watched && options.imdbId && options.imdbId !== meta.id) {
          setMovieWatchedLocalAcknowledged(options.imdbId, false);
          setWatchedFlagAcknowledged(options.imdbId, false);
        }
        if (watched) savePlayback(meta.id, { title: meta.name, parsedTitle: meta.name });
      } else {
        setManualWatchedManyAcknowledged(meta.id, episodes, watched);
        // An individual episode can invalidate an all-watched flag, but cannot establish one.
        if ((!options.episode && !options.episodes) || !watched)
          setWatchedFlagAcknowledged(meta.id, watched && !options.episode && !options.episodes);
        if (
          !watched &&
          options.imdbId &&
          options.imdbId !== meta.id &&
          !options.syncMetaId &&
          (!nativeAnime || options.providerEpisode)
        ) {
          setManualWatchedManyAcknowledged(
            options.imdbId,
            options.providerEpisode ? [options.providerEpisode] : episodes,
            false,
          );
          setWatchedFlagAcknowledged(options.imdbId, false);
        }
        if (watched)
          recordManualWatchedMeta(meta.id, {
            type: "series",
            name: meta.name,
            poster: meta.poster,
            background: meta.background,
            markedAt: new Date().toISOString(),
          });
      }
      if (watched)
        recordWatchEvent({
          id: meta.id,
          type: isMovie ? "movie" : "series",
          name: meta.name,
          poster: meta.poster,
          at: Date.now(),
        });
    },
    watchedProviderWrites(
      options.syncMetaId ? { ...meta, id: options.syncMetaId } : meta,
      watched,
      {
        episodes: options.providerEpisode ? [options.providerEpisode] : episodes,
        videos,
        imdbId: options.syncMetaId ? undefined : options.imdbId,
        ...(options.providerEpisode ? { verifiedEpisodeMapping: true } : {}),
      },
    ),
    assertCurrent,
    options.onUnsafeProvider,
  );
}
