import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";
import { type PlayEpisode } from "@/lib/view";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { useHideAnimeMetas } from "@/lib/anime-hide";
import { useInLocalLibrary } from "@/lib/local-library";
import { useTitleMediaServers } from "@/hooks/use-title-media-servers";
import { useSettings } from "@/lib/settings";
import { ratingTarget } from "@/lib/ratings/types";
import type { AwardType } from "@/lib/providers/wikidata";
import { useBpDetail } from "./use-bp-detail";
import { bpEpisodeAt, useBpEpisodeIds } from "./bp-episode-ids";
import { useBpAnimeDetail } from "./use-bp-anime-detail";
import { useBpLibraryItem } from "./use-bp-library-item";
import { BpAnimeSeasonChips, BpAnimeEpisodeStrip } from "./bp-anime-seasons";
import { BpAnimeCharactersRow } from "./bp-anime-characters";
import { BpEpisodeSeasonChips, BpEpisodeStrip, useBpEpisodeStrip } from "./bp-episodes";
import { BpCastRow } from "./bp-cast-row";
import { BpGalleryRow, type BpGalleryShape } from "./bp-gallery-row";
import { BpFacts } from "./bp-facts";
import { BpRow } from "./bp-row";
import { BpTrailer } from "./bp-trailer";
import { BpStreams } from "./bp-streams";
import { useBpCardBadges } from "./use-bp-card-badges";
import {
  bpPlayPending,
  bpPlayResumeAt,
  bpPlayVersion,
  subscribeBpPlay,
  takeBpPlayIntent,
} from "./bp-play-request";
import { BpPageMessage } from "./bp-page-message";
import { runBpBack } from "./bp-back";
import { BpRateDialog } from "./bp-rate-dialog";
import { BpListDialog } from "./bp-list-dialog";
import { BpSeasonMenu } from "./bp-season-menu";
import { BpStatusDialog } from "./bp-status-dialog";
import { useBpDetailActions } from "./use-bp-detail-actions";
import { useBpTrackers } from "./use-bp-trackers";
import { lockBpMeta, unlockBpMeta } from "./bp-focus-meta";
import { useBpT } from "./bp-i18n";
import { BpAwardsRow, useBpTitleAwards } from "./detail/bp-awards-row";
import { BpAwardDetailDialog } from "./detail/bp-award-detail-dialog";
import { BpCrewRow } from "./detail/bp-crew-row";
import { BpDetailHero } from "./detail/bp-detail-hero";
import { BpFactsDialog } from "./detail/bp-facts-dialog";
import { bpResumeMark } from "./detail/bp-resume-mark";
import { useBpGroundFade } from "./detail/use-bp-ground-fade";
import { BpVideosRow } from "./detail/bp-videos-row";
import { BpWatchOnRow } from "./detail/bp-watch-on-row";

export function BpDetail({
  metaId,
  onSelect,
  onSources,
}: {
  metaId: string;
  onSelect: (m: Meta) => void;
  onSources: (
    meta: Meta,
    episode: PlayEpisode | undefined,
    resume: boolean,
    auto: boolean,
    applyPreference: boolean,
  ) => void;
}) {
  const { meta, detail: tmdbDetail, collection, providers, loading } = useBpDetail(metaId);
  const t = useBpT();
  // A kitsu id resolves to nothing on TMDB, so anime detail comes from the
  // provider chain the desktop uses and stands in for the TMDB record entirely.
  const anime = useBpAnimeDetail(meta);
  // The anime chain resolves the full stream mapping itself, so the id index is
  // only paid for on the path it does not own: a tt or tmdb shell whose videos
  // are Kitsu addon stream ids, and a kitsu title whose provider chain came back
  // empty. Running both costs a second uncached TVDB proxy round trip per title.
  const episodeIds = useBpEpisodeIds(anime.owns ? null : meta);
  const detail = anime.detail ?? tmdbDetail;
  const cwEntry = useBpLibraryItem(meta?.id ?? "", detail?.imdbId ?? null);
  const { settings } = useSettings();
  const slides = useMemo(() => (meta ? [meta] : []), [meta?.id]);
  const logos = useHeroLogos(slides, settings);
  const [trailer, setTrailer] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [awardType, setAwardType] = useState<AwardType | null>(null);
  const [download, setDownload] = useState(false);
  const [seasonMenu, setSeasonMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const groundRef = useBpGroundFade(scrollRef, meta?.id);

  const shell: Meta = meta ?? { id: "", type: "movie", name: "" };
  const imdbId = detail?.imdbId ?? (shell.id.startsWith("tt") ? shell.id.split(":")[0] : null);
  const isSeries = shell.type === "series" || shell.type === "anime";
  const title = detail?.title || shell.name;
  const poster = shell.poster ?? detail?.poster;
  const videoMark = useMemo(
    () => (isSeries ? bpResumeMark(meta, cwEntry, episodeIds) : { resumed: false }),
    [meta, cwEntry, isSeries, episodeIds],
  );
  // The kitsu videos on the meta carry no stream mapping, so once the ordered
  // anime episodes exist they own the resume target and Play resolves.
  const mark = isSeries && anime.resume ? anime.resume : videoMark;
  // animeDetails remaps an ova or a side entry onto its main series, so the
  // tracker key is the canonical kitsu id and never the shell the user arrived
  // under. Filing a status against the shell writes it onto the wrong title on
  // AniList, MAL and Simkl, and there is no undo for that.
  const trackerMeta = useMemo(
    () =>
      anime.canonicalId && anime.canonicalId !== shell.id
        ? { ...shell, id: anime.canonicalId }
        : shell,
    [shell, anime.canonicalId],
  );
  const trackers = useBpTrackers({ meta: trackerMeta, isMovie: shell.type === "movie" });
  const activeTracker = trackers.find((tr) => tr.key === dialog) ?? null;

  // The season strip and the card strip read one state object, because they are
  // two rail rows and neither can own the season the other renders.
  const episodeStrip = useBpEpisodeStrip({
    meta: shell,
    ids: episodeIds,
    tvId: tmdbDetail?.kind === "tv" ? tmdbDetail.id : null,
    imdbId,
    cwEntry,
    enabled: isSeries && !anime.owns,
  });
  const inLibrary = useInLocalLibrary(meta?.id, [imdbId]);
  const homeServers = useTitleMediaServers(meta?.id, imdbId);
  const awardGroups = useBpTitleAwards(shell, imdbId);
  // No ref: a hero is on screen by definition. Surface "detail" is load bearing.
  // Harbor keeps two independent settings families, showXBadge for cards and
  // showXDetail for detail pages, and they diverge on stock defaults, so reading
  // the card family here dropped six of the ten providers and ignored a user who
  // had switched a provider off for detail pages only.
  const { badges } = useBpCardBadges(shell, undefined, imdbId, "detail");
  const recSource = useMemo(() => detail?.recommendations ?? [], [detail]);
  const similarSource = useMemo(() => detail?.similar ?? [], [detail]);
  const recommendations = useHideAnimeMetas(recSource);
  const similar = useHideAnimeMetas(similarSource);

  const play = (episode?: PlayEpisode, fromStrip = false, knownResumeTarget = false) => {
    if (!meta) return;
    // A series with no resolvable episode still must not ask addons for
    // series-level streams, so it falls back to the premiere like the desktop.
    const ep = episode ?? mark.ep ?? (isSeries ? bpEpisodeAt(1, 1, episodeIds) : undefined);
    // resume only unlocks the remembered-stream fast path, so it belongs to the
    // episode the user actually left off on. knownResumeTarget is the caller
    // having named that episode itself, which is the one case where mark is not
    // the authority: it may still be holding the premiere fallback because
    // cwEntry has not landed.
    const onResumeTarget =
      knownResumeTarget ||
      !ep ||
      !mark.ep ||
      (ep.season === mark.ep.season && ep.episode === mark.ep.episode);
    const auto =
      settings.playbackSourcePreference === "online" &&
      (settings.instantPlay || (fromStrip && settings.seasonSourceLock));
    onSources(meta, ep, onResumeTarget, auto, true);
  };

  const trailerYtId = detail?.trailerYtId ?? shell.trailerStreams?.[0]?.ytId ?? null;

  const actions = useBpDetailActions({
    meta: shell,
    title,
    poster,
    imdbId,
    isSeries,
    trailerYtId,
    libraryItem: cwEntry,
    // An explicit Sources press is the user asking to choose, so it must not
    // unlock the remembered-stream fast path.
    onSources: () => {
      if (meta) {
        onSources(
          meta,
          mark.ep ?? (isSeries ? bpEpisodeAt(1, 1, episodeIds) : undefined),
          false,
          false,
          false,
        );
      }
    },
    onTrailer: () => {
      if (trailerYtId) setTrailer(trailerYtId);
    },
    onDownload: () => setDownload(true),
    onRate: () => setDialog("rate"),
    onLists: () => setDialog("lists"),
    trackers,
    onTracker: setDialog,
  });

  // A play handed over from the quick panel arrives before the library entry
  // that carries the resume episode, and firing early restarts a series at its
  // premiere.
  const playSeq = useSyncExternalStore(subscribeBpPlay, bpPlayVersion);
  useEffect(() => {
    if (!meta || !bpPlayPending(metaId)) return;
    // A caller that named the episode has already won the race, so there is
    // nothing to wait for and nothing for the premiere fallback to clobber.
    const hinted = bpPlayResumeAt(metaId);
    const id = window.setTimeout(
      () => {
        const intent = takeBpPlayIntent(metaId);
        if (!intent) return;
        const at = intent.resumeAt;
        if (at) play(bpEpisodeAt(at.season, at.episode, episodeIds), false, true);
        else play();
      },
      isSeries && !cwEntry && !hinted ? 500 : 0,
    );
    return () => window.clearTimeout(id);
  }, [meta, metaId, isSeries, cwEntry, playSeq, episodeIds]);

  useEffect(() => {
    if (!meta) return;
    lockBpMeta(meta);
    return unlockBpMeta;
  }, [meta?.id, meta?.background]);

  if (!meta) {
    return (
      <BpPageMessage
        title={loading ? t("Loading...") : t("Couldn't load this title.")}
        body={
          loading
            ? ""
            : t(
                "Harbor couldn't reach the catalog servers. Check the connection and reopen Big Picture.",
              )
        }
        action={t("Go back")}
        onAction={() => runBpBack()}
      />
    );
  }

  const gallery = (key: string, label: string, images: string[], shape: BpGalleryShape) => ({
    key,
    node: <BpGalleryRow rowKey={key} title={label} images={images} shape={shape} />,
  });

  // Vertical here was pure geometry, because detail and person were the only BP
  // pages whose rows carried no rail index, and a cast card is tall enough to
  // out-rank the row directly beneath it. Indices come from position in this
  // list, never from arithmetic: a gap in data-bp-rail-row breaks vertical
  // outright. A row that renders nothing keeps its index and is stepped over.
  //
  // One entry, one [data-bp-row]. bpRailStep measures every focusable in an
  // index and takes the first, so the season chips and the episode cards under
  // a single index made the cards unreachable on every multi-season title.
  const rows: Array<{ key: string; node: ReactNode }> = [
    {
      key: "episode-filters",
      node: !isSeries ? null : anime.owns ? (
        <BpAnimeSeasonChips anime={anime} />
      ) : (
        <BpEpisodeSeasonChips
          state={episodeStrip}
          open={seasonMenu}
          onOpen={() => setSeasonMenu(true)}
        />
      ),
    },
    {
      key: "episodes",
      node: !isSeries ? null : anime.owns ? (
        <BpAnimeEpisodeStrip anime={anime} onPlay={(e) => play(e, true)} />
      ) : (
        <BpEpisodeStrip state={episodeStrip} onPlay={(e) => play(e, true)} />
      ),
    },
    { key: "watch-on", node: <BpWatchOnRow providers={providers} /> },
    { key: "crew", node: detail ? <BpCrewRow detail={detail} /> : null },
    { key: "cast", node: detail ? <BpCastRow cast={detail.cast} anime={anime.owns} /> : null },
    { key: "characters", node: <BpAnimeCharactersRow anime={anime} /> },
    {
      key: "collection",
      node: collection ? (
        <BpRow title={collection.name} metas={collection.parts} onSelect={onSelect} />
      ) : null,
    },
    {
      key: "recommendations",
      node: <BpRow title={t("More Like This")} metas={recommendations} onSelect={onSelect} />,
    },
    {
      key: "similar",
      node: <BpRow title={t("You Might Also Like")} metas={similar} onSelect={onSelect} />,
    },
    { key: "videos", node: detail ? <BpVideosRow detail={detail} onPlay={setTrailer} /> : null },
    { key: "awards", node: <BpAwardsRow groups={awardGroups} onOpen={setAwardType} /> },
    {
      key: "facts",
      node: detail ? <BpFacts detail={detail} onOpen={() => setDialog("facts")} /> : null,
    },
    // Artwork last. Awards and the fact panel answer "is this worth my time"
    // and "who made it", and they sat three and six Down presses below three
    // rows of wallpaper.
    gallery("backdrops", t("Backdrops"), detail?.gallery.backdrops ?? [], "wide"),
    gallery("posters", t("Posters"), detail?.gallery.posters ?? [], "tall"),
    gallery("logos", t("Logos"), detail?.gallery.logos ?? [], "logo"),
  ];

  const openAward = awardGroups.find((g) => g.type === awardType) ?? null;

  return (
    <>
      <div
        ref={scrollRef}
        data-bp-scroll-y
        className="relative h-full overflow-y-auto pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={groundRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />
        <BpDetailHero
          meta={meta}
          detail={detail}
          heroLogo={logos[meta.id]}
          badges={badges}
          imdbId={imdbId}
          inLibrary={inLibrary}
          homeServers={homeServers}
          mark={mark}
          cwEntry={cwEntry}
          actions={actions}
          onPlay={() => play()}
        />

        <div className="mt-[clamp(44px,5.5vh,88px)] flex flex-col gap-[var(--bp-row-gap)]">
          {/* empty:hidden, not omission: a row that resolves to nothing keeps its
              index and is stepped over, but an empty flex item still eats a
              --bp-row-gap, which is up to 52px of dead band per silent row. A
              movie opened with no TMDB key nulls five of these at once. */}
          {rows.map((r, i) => (
            <div key={r.key} data-bp-rail-row={i} className="empty:hidden">
              {r.node}
            </div>
          ))}
        </div>

        {trailer && <BpTrailer ytId={trailer} title={meta.name} onClose={() => setTrailer(null)} />}
      </div>

      {dialog === "rate" && (
        <BpRateDialog
          target={ratingTarget(
            { id: meta.id, name: title, poster },
            meta.type === "anime" ? "anime" : isSeries ? "series" : "movie",
          )}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "lists" && (
        <BpListDialog
          item={{ id: meta.id, type: meta.type, name: title, poster }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "facts" && detail && (
        <BpFactsDialog detail={detail} title={title} onClose={() => setDialog(null)} />
      )}
      {activeTracker && <BpStatusDialog tracker={activeTracker} onClose={() => setDialog(null)} />}
      {openAward && (
        <BpAwardDetailDialog
          type={openAward.type}
          entries={openAward.entries}
          onClose={() => setAwardType(null)}
        />
      )}
      {download && <BpStreams meta={meta} intent="download" onClose={() => setDownload(false)} />}
      {seasonMenu && !anime.owns && episodeStrip.seasons.length > 1 && (
        <BpSeasonMenu
          seasons={episodeStrip.seasons}
          counts={episodeStrip.seasonCounts}
          value={episodeStrip.active}
          onPick={(s) => {
            episodeStrip.onSeason(s);
            setSeasonMenu(false);
          }}
          onClose={() => setSeasonMenu(false)}
        />
      )}
    </>
  );
}
