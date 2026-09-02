import { useEffect, useMemo, useState, type RefObject } from "react";
import type { Meta } from "@/lib/cinemeta";
import { externalToKitsu, kitsuToImdb } from "@/lib/providers/anime-mapping";
import { cinemetaRatingPrefetch, useCinemetaRating } from "@/lib/providers/cinemeta-rating";
import { harborImdbTitle } from "@/lib/providers/harbor-imdb";
import { mdblistCardPrefetch, useMdblistCardScores } from "@/lib/providers/mdblist-batch";
import { omdbPrefetch, useOmdbScores } from "@/lib/providers/omdb";
import { tmdbImdbId, useTmdbImdbId, useTmdbVote } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import { useSimklCardScores, useSimklCardScoresByAnimeId } from "@/lib/simkl/ratings";
import { useBpCardVisible } from "./bp-card-visible";

// Twin of src/components/pick-card.tsx:172-229. The desktop chain is not
// extracted because pick-card is the most-used component in the app and a
// "pure move" that is not pure breaks every card everywhere. If a provider
// condition changes there, change it here too.

export const BP_ANIME_ID = /^(kitsu|mal|anilist|anidb|simkl):/;
const ANIME_NUMERIC_ID = /^(kitsu|mal|anilist|anidb):(\d+)/;

export type BpCardBadge =
  | { kind: "rating"; source: "imdb" | "mal" | "tmdb"; value: string }
  | { kind: "simkl"; value: number }
  | { kind: "rt"; value: number }
  | { kind: "audience"; value: number }
  | { kind: "metacritic"; value: number }
  | { kind: "letterboxd"; value: number }
  | { kind: "mdblist"; value: number }
  | { kind: "trakt"; value: number };

export type BpCardBadges = { badges: readonly BpCardBadge[]; imdbId: string | undefined };

/**
 * Which settings family answers "is this provider on".
 *
 * Harbor ships two independent sets, showXBadge for cards and showXDetail for
 * detail pages, and they diverge on stock defaults: TMDB, RT audience,
 * Metacritic, Letterboxd, MDBList and Trakt are all off for cards and on for
 * detail. Reading the card family on a detail page drops six of the ten
 * providers and ignores a user who switched IMDb off for detail pages only.
 */
export type BpBadgeSurface = "card" | "detail" | "tile";

type BpBadgeGates = {
  imdb: boolean;
  tmdb: boolean;
  mal: boolean;
  rt: boolean;
  audience: boolean;
  metacritic: boolean;
  letterboxd: boolean;
  mdblist: boolean;
  trakt: boolean;
  simkl: boolean;
  /** Detail shows an anime's MAL and IMDb scores side by side. A card shows one. */
  pairAnimeImdb: boolean;
};

const NO_GATES: BpBadgeGates = {
  imdb: false,
  tmdb: false,
  mal: false,
  rt: false,
  audience: false,
  metacritic: false,
  letterboxd: false,
  mdblist: false,
  trakt: false,
  simkl: false,
  pairAnimeImdb: false,
};

function badgeGates(settings: Settings, surface: BpBadgeSurface): BpBadgeGates {
  // A ten-foot card carries no score plate. The card already has to hold a
  // title once it is focused, and the plate was laid out under that title, so
  // taking focus pushed the score upward and the row read as though it had
  // jolted. Desktop keeps its badges, which is where a viewer leaning in to
  // compare numbers actually is; across a room the hero above the row is
  // showing the score for whatever the ring is on anyway.
  //
  // Every gate false also means `want` is false, so no card fetches a rating at
  // all. imdbId is still resolved below, because watchlist, watched and local
  // state need it and never wanted a badge in the first place.
  if (surface === "tile") return NO_GATES;
  if (surface === "detail") {
    const on = settings.showDetailRatings !== false;
    return {
      imdb: on && settings.showImdbDetail,
      tmdb: on && settings.showTmdbDetail,
      mal: on && settings.showMalDetail,
      rt: on && settings.showRtDetail,
      audience: on && settings.showRtAudienceDetail,
      metacritic: on && settings.showMetacriticDetail,
      letterboxd: on && settings.showLetterboxdDetail,
      mdblist: on && settings.showMdblistDetail,
      trakt: on && settings.showTraktDetail,
      simkl: on && settings.showSimklDetail,
      pairAnimeImdb: true,
    };
  }
  return {
    imdb: settings.showImdbBadge,
    tmdb: settings.showTmdbBadge,
    mal: settings.showMalBadge,
    rt: settings.showRtBadge,
    audience: settings.showPopcornBadge,
    metacritic: settings.showMetacriticBadge,
    letterboxd: settings.showLetterboxdBadge,
    mdblist: settings.showMdblistBadge,
    trakt: settings.showTraktBadge,
    simkl: settings.showSimklBadge,
    pairAnimeImdb: false,
  };
}

const NO_BADGES: readonly BpCardBadge[] = Object.freeze([]);

async function resolveAnimeImdb(metaId: string): Promise<string | null> {
  const m = metaId.match(ANIME_NUMERIC_ID);
  if (!m) return null;
  const idNum = Number(m[2]);
  if (!Number.isFinite(idNum)) return null;
  let kitsuId: number | null = m[1] === "kitsu" ? idNum : null;
  if (kitsuId == null) {
    const armSource = m[1] === "mal" ? "myanimelist" : m[1];
    kitsuId = await externalToKitsu(armSource, idNum).catch(() => null);
  }
  if (kitsuId == null) return null;
  return kitsuToImdb(kitsuId).catch(() => null);
}

/**
 * Every score a card can carry, in desktop's push order, gated by the same
 * settings desktop reads. Pass no ref for a hero, which is on screen by
 * definition; pass the tile ref anywhere a row can hold hundreds of these.
 */
export function useBpCardBadges(
  meta: Meta,
  ref?: RefObject<HTMLElement | null>,
  imdbHint?: string | null,
  surface: BpBadgeSurface = "card",
): BpCardBadges {
  const { settings } = useSettings();
  const gate = badgeGates(settings, surface);
  const isAnime = BP_ANIME_ID.test(meta.id);
  const mediaKind = meta.type === "series" ? "show" : "movie";
  const cinemetaKind = meta.type === "series" ? "series" : "movie";

  const wantMdblist =
    gate.audience || gate.metacritic || gate.letterboxd || gate.mdblist || gate.trakt || gate.simkl;
  // One boolean before any subscription. On a default install with no keys the
  // MDBList branch alone is off for six of the ten providers.
  const want = gate.imdb || gate.tmdb || gate.mal || gate.rt || wantMdblist;

  // Resolved even when no badge wants it: the watchlist, watched and local
  // library marks all match on the alternate id too.
  const resolved = useTmdbImdbId(meta.id);
  const imdbId = (imdbHint ?? resolved) ?? undefined;
  const scoreId = want ? imdbId : undefined;

  const visible = useBpCardVisible(ref);
  const [animeImdb, setAnimeImdb] = useState<string>();
  const [harborRating, setHarborRating] = useState<string>();

  // A card shows one anime score and animeCardRating picks which. A detail page
  // shows both, so there the IMDb chip alone is enough to want the mapping.
  const animeWantsImdb =
    isAnime && (gate.pairAnimeImdb ? gate.imdb : settings.animeCardRating === "imdb" && gate.mal);
  // Two round trips through the kitsu mapping per tile, so it stays behind the
  // viewport gate and behind a setting that ships off.
  const wantAnimeMap = visible && animeWantsImdb;
  const wantImdbValue = isAnime ? animeWantsImdb : gate.imdb;
  const ratingTt = wantImdbValue ? (isAnime ? animeImdb : imdbId) : undefined;

  useEffect(() => {
    setAnimeImdb(undefined);
    setHarborRating(undefined);
  }, [meta.id]);

  useEffect(() => {
    if (!wantAnimeMap) return;
    let cancelled = false;
    resolveAnimeImdb(meta.id)
      .then((tt) => {
        if (!cancelled && tt) setAnimeImdb(tt);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wantAnimeMap, meta.id]);

  useEffect(() => {
    if (!visible || !ratingTt || !ratingTt.startsWith("tt")) return;
    let cancelled = false;
    harborImdbTitle(ratingTt)
      .then((r) => {
        if (!cancelled && r != null) setHarborRating(r.toFixed(1));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, ratingTt]);

  const hasInlineImdb = meta.id.startsWith("tt") && !!meta.imdbRating;
  const wantCinemetaRating = gate.imdb && !isAnime && !hasInlineImdb;

  const wantOmdb = gate.imdb || gate.rt;

  useEffect(() => {
    if (!visible || !want) return;
    const needsOmdb = !!settings.omdbKey && wantOmdb;
    const needsMdblist = !!settings.mdblistKey && wantMdblist;
    if (!needsOmdb && !needsMdblist && !wantCinemetaRating) return;
    let cancelled = false;
    void (async () => {
      const id = imdbId ?? (await tmdbImdbId(settings.tmdbKey, meta.id).catch(() => null));
      if (cancelled || !id) return;
      if (needsOmdb) void omdbPrefetch(settings.omdbKey, id);
      if (needsMdblist) mdblistCardPrefetch(id, mediaKind);
      if (wantCinemetaRating) cinemetaRatingPrefetch(id, cinemetaKind);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    want,
    wantOmdb,
    wantMdblist,
    wantCinemetaRating,
    imdbId,
    meta.id,
    mediaKind,
    cinemetaKind,
    settings.omdbKey,
    settings.mdblistKey,
    settings.tmdbKey,
  ]);

  const omdb = useOmdbScores(wantOmdb ? scoreId : undefined);
  const cardScores = useMdblistCardScores(wantMdblist ? scoreId : undefined, mediaKind);
  const cinemetaRating = useCinemetaRating(wantCinemetaRating ? scoreId : undefined);
  // Behind the viewport gate like every other provider here: this one issues a
  // TMDB request per id, and a catalog page mounts every row at once.
  const tmdbVote = useTmdbVote(
    visible && gate.tmdb && !isAnime ? meta.id : undefined,
    meta.type === "series" ? "series" : "movie",
    settings.tmdbKey,
  );
  const simklImdb = useSimklCardScores(gate.simkl && !isAnime ? scoreId : undefined);
  const simklAnime = useSimklCardScoresByAnimeId(gate.simkl && isAnime ? meta.id : undefined);
  const simklValue = (isAnime ? simklAnime.score : simklImdb.score) ?? cardScores?.simkl ?? null;

  const imdbValue = isAnime
    ? undefined
    : (harborRating ??
      omdb?.imdbRating ??
      cinemetaRating ??
      (meta.id.startsWith("tt") ? meta.imdbRating : undefined));
  // For a kitsu/mal/anilist meta, meta.imdbRating carries the anime score, not
  // an IMDb one. Drawing it beside the IMDb mark is what BP did before.
  const animeValue =
    isAnime && gate.mal
      ? animeWantsImdb && harborRating && !gate.pairAnimeImdb
        ? harborRating
        : meta.imdbRating
      : undefined;
  const animeSource: "imdb" | "mal" =
    animeWantsImdb && harborRating && !gate.pairAnimeImdb ? "imdb" : "mal";
  const animeImdbValue = isAnime && gate.pairAnimeImdb && gate.imdb ? harborRating : undefined;

  const rtCritics = omdb?.rtCritics ?? null;
  const badges = useMemo<readonly BpCardBadge[]>(() => {
    if (!want) return NO_BADGES;
    const out: BpCardBadge[] = [];
    if (isAnime) {
      if (animeValue) out.push({ kind: "rating", source: animeSource, value: animeValue });
      if (animeImdbValue) out.push({ kind: "rating", source: "imdb", value: animeImdbValue });
    } else {
      if (gate.imdb && imdbValue) out.push({ kind: "rating", source: "imdb", value: imdbValue });
      if (gate.tmdb && tmdbVote) out.push({ kind: "rating", source: "tmdb", value: tmdbVote });
    }
    if (gate.simkl && simklValue != null) out.push({ kind: "simkl", value: simklValue });
    if (gate.rt && rtCritics != null) out.push({ kind: "rt", value: rtCritics });
    if (gate.audience && cardScores?.rtAudience != null)
      out.push({ kind: "audience", value: cardScores.rtAudience });
    if (gate.metacritic && cardScores?.metacritic != null)
      out.push({ kind: "metacritic", value: cardScores.metacritic });
    if (gate.letterboxd && cardScores?.letterboxd != null)
      out.push({ kind: "letterboxd", value: cardScores.letterboxd });
    if (gate.mdblist && cardScores?.score != null)
      out.push({ kind: "mdblist", value: cardScores.score });
    if (gate.trakt && cardScores?.trakt != null) out.push({ kind: "trakt", value: cardScores.trakt });
    return out.length > 0 ? out : NO_BADGES;
  }, [
    want,
    isAnime,
    animeValue,
    animeSource,
    animeImdbValue,
    imdbValue,
    tmdbVote,
    simklValue,
    rtCritics,
    cardScores,
    gate.imdb,
    gate.tmdb,
    gate.simkl,
    gate.rt,
    gate.audience,
    gate.metacritic,
    gate.letterboxd,
    gate.mdblist,
    gate.trakt,
  ]);

  return { badges, imdbId };
}
