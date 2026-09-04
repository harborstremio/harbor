import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { socialPatch } from "@/lib/social/client";
import {
  CARD_ORDER_DEFAULT,
  effectiveOrder,
  moveCard,
  sanitizeLayout,
  type CardKey,
} from "@/lib/profile-card-layout";
import { ProfileCardControls } from "./profile-card-controls";
import { useT } from "@/lib/i18n";
import { useMangaProgressList } from "@/lib/manga-progress";
import { useWatchedCount } from "@/lib/playback-history";
import {
  pushStats,
  useLibraryWatchedBreakdown,
  useLibraryWatchedCount,
} from "@/lib/social/stats-sync";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useCustomLists } from "@/lib/custom-lists";
import { currentAuthor } from "@/lib/theme-auth";
import { useScrollMemory, useView } from "@/lib/view";
import { pushBackHandler } from "@/lib/back-intercept";
import { consumeProfileEditIntent } from "@/lib/social/open-profile";
import { BadgesRow } from "./badges-row";
import { CommentsSection } from "./comments-section";
import { FriendsPanel } from "./friends-panel";
import { GroupsPanel } from "./groups-panel";
import { SocialsPanel } from "./socials-panel";
import { AboutCard } from "./about-card";
import { FavoritesCard } from "./favorites-card";
import { FavoritesPicker } from "./favorites-picker";
import type { FavoriteKind } from "./use-favorites";
import { RatingsCard } from "./ratings-card";
import { UserRatings } from "@/views/ratings/user-ratings";
import { ImportModal } from "@/views/ratings/import/import-modal";
import { WatchNowCard } from "./watch-now-card";
import { ProfileAudioCard } from "./profile-audio-card";
import { MinecraftCard } from "./minecraft-card";
import { SimklCard } from "./simkl-card";
import { LetterboxdCard } from "./letterboxd-card";
import { ProfileHero } from "./profile-hero";
import { ProfileSettings } from "./profile-settings";
import { ScrollToTop } from "./scroll-to-top";
import { ProfileSkeleton } from "./profile-skeleton";
import { ProfileEmpty, ProfileError, ProfilePrivate } from "./profile-states";
import { MyListsShowcase } from "./my-lists-showcase";
import { MyListsPicker } from "./my-lists-picker";
import { ProfileViewAll } from "./profile-view-all";
import { RecentActivity } from "./recent-activity";
import { Showcase } from "./showcase";
import { useProfile } from "./use-profile";
import { CanvasCard } from "./customization/canvas-frame";
import { resolveCustomization, useFontLink } from "./customization/apply";

export function ProfileView({
  handle,
  onOpenProfile,
  onOpenMeta,
}: {
  handle: string;
  onOpenProfile?: (handle: string) => void;
  onOpenMeta?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  const { goBack } = useView();
  const t = useT();
  const { authKey, user } = useAuth();
  const { activeProfile } = useProfiles();
  const { settings } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [pickingLists, setPickingLists] = useState(false);
  const [pickingFav, setPickingFav] = useState<FavoriteKind | null>(null);
  const [expanded, setExpanded] = useState<null | "lists" | "badges" | "activity">(null);
  const [showRatings, setShowRatings] = useState(false);
  const [importingRatings, setImportingRatings] = useState(false);
  const [arranging, setArranging] = useState(false);
  const mangaProgress = useMangaProgressList();
  const watchedCount = useWatchedCount();
  const { state, summary, friends, badges, activity, reload, patchSummary } = useProfile(handle);
  const localLists = useCustomLists();
  const isOwner = summary?.isOwner ?? false;
  const viewerSignedIn = !!currentAuthor();
  const libWatched = useLibraryWatchedCount(authKey, isOwner);
  const watchedBreakdown = useLibraryWatchedBreakdown(authKey, isOwner);
  const custom = summary ? resolveCustomization(summary) : null;
  useFontLink(custom?.fontHref ?? "");

  useScrollMemory(`profile:${handle}`, scrollRef);

  const cloudWatched = summary?.counts.watched ?? 0;
  const cloudManga = summary?.counts.mangaRead ?? 0;
  const cloudMovies = summary?.counts.moviesWatched ?? 0;
  const cloudEpisodes = summary?.counts.episodesWatched ?? 0;
  const cloudMinutes = summary?.counts.minutesWatched ?? 0;

  useEffect(() => {
    if (!isOwner || !watchedBreakdown.ready) return;
    const w = Math.max(watchedCount, libWatched);
    const m = mangaProgress.length;
    const movies = watchedBreakdown.moviesWatched;
    const episodes = watchedBreakdown.episodesWatched;
    const minutes = watchedBreakdown.minutesWatched;

    if (
      w === cloudWatched &&
      m === cloudManga &&
      movies === cloudMovies &&
      episodes === cloudEpisodes &&
      minutes === cloudMinutes
    )
      return;
    pushStats(w, m, movies, episodes, minutes);
  }, [
    isOwner,
    libWatched,
    watchedCount,
    mangaProgress.length,
    cloudWatched,
    cloudManga,
    cloudMovies,
    cloudEpisodes,
    cloudMinutes,
    watchedBreakdown,
  ]);

  useEffect(() => {
    if (isOwner && consumeProfileEditIntent(handle)) setEditing(true);
  }, [isOwner, handle]);

  useEffect(() => {
    if (!editing && !arranging && !pickingLists && !pickingFav && expanded == null) return;
    return pushBackHandler(() => {
      if (pickingFav) return (setPickingFav(null), true);
      if (pickingLists) return (setPickingLists(false), true);
      if (expanded != null) return (setExpanded(null), true);
      if (arranging) return (setArranging(false), true);
      if (editing) return (setEditing(false), true);
      return false;
    });
  }, [editing, arranging, pickingLists, pickingFav, expanded]);

  if (state === "loading") return <ProfileSkeleton />;
  if (state === "error") return <ProfileError onRetry={reload} onBack={goBack} />;
  if (state === "empty" || !summary) return <ProfileEmpty handle={handle} onBack={goBack} />;

  const locked = summary.private && !summary.isOwner;
  const ownerAvatar = summary.isOwner
    ? activeProfile?.avatar ||
      settings.harborAvatar ||
      user?.avatar ||
      currentAuthor()?.avatar ||
      undefined
    : undefined;
  const heroAvatar = summary.isOwner
    ? ownerAvatar || summary.avatarUrl
    : summary.avatarUrl || undefined;
  const heroAvatarFallback = summary.isOwner ? summary.avatarUrl || undefined : undefined;
  const mangaReadCount = summary.isOwner ? mangaProgress.length : undefined;

  if (editing && summary.isOwner) {
    return (
      <ProfileSettings
        summary={summary}
        badges={badges}
        onClose={() => setEditing(false)}
        onSaved={patchSummary}
        onArrange={() => {
          setEditing(false);
          setArranging(true);
        }}
      />
    );
  }

  const c = resolveCustomization(summary);
  const featuredLists = summary.featuredLists?.map((featured) => {
    if (!summary.isOwner || featured.description) return featured;
    const local = localLists.find(
      (list) => list.name.trim().toLowerCase() === featured.name.trim().toLowerCase(),
    );
    return local?.description ? { ...featured, description: local.description } : featured;
  });

  const layout = sanitizeLayout(summary.cardLayout);
  const hiddenSet = new Set(layout.hidden ?? []);
  const applyLayout = (order: CardKey[], hidden: string[]) => {
    const next = { order, hidden };
    patchSummary({ ...summary, cardLayout: next });
    void socialPatch("/social/me/profile", { cardLayout: next }).catch(() => {});
  };
  const cardNodes: Partial<Record<CardKey, ReactNode>> = {
    about: (
      <AboutCard
        description={summary.description}
        isOwner={summary.isOwner}
        userFont={c.font}
        onEdit={() => setEditing(true)}
        hideTitle={c.hideCardTitles}
      />
    ),
    ratings: (
      <RatingsCard
        ratings={summary.ratings}
        isOwner={summary.isOwner}
        onViewAll={() => setShowRatings(true)}
        onImport={summary.isOwner ? () => setImportingRatings(true) : undefined}
        onOpenMeta={onOpenMeta}
      />
    ),
    canvas: c.hasCanvas ? (
      <CanvasCard
        html={c.html}
        css={c.css}
        height={c.height}
        hiddenFromVisitors={c.hiddenFromVisitors}
        hideTitle={c.hideCardTitles}
      />
    ) : undefined,
    showcase: (
      <Showcase
        item={summary.showcase}
        onOpen={onOpenMeta}
        isOwner={summary.isOwner}
        onCleared={patchSummary}
      />
    ),
    lists: (
      <MyListsShowcase
        lists={featuredLists ?? []}
        isOwner={summary.isOwner}
        signedIn={viewerSignedIn}
        onOpenMeta={onOpenMeta}
        onViewAll={() => setExpanded("lists")}
        onManage={() => setPickingLists(true)}
        handle={handle}
      />
    ),
    favgames:
      summary.isOwner || (summary.favorites?.game?.length ?? 0) > 0 ? (
        <FavoritesCard
          kind="game"
          items={summary.favorites?.game ?? []}
          isOwner={summary.isOwner}
          hideTitle={c.hideCardTitles}
          onManage={() => setPickingFav("game")}
        />
      ) : undefined,
    favbooks:
      summary.isOwner || (summary.favorites?.book?.length ?? 0) > 0 ? (
        <FavoritesCard
          kind="book"
          items={summary.favorites?.book ?? []}
          isOwner={summary.isOwner}
          hideTitle={c.hideCardTitles}
          onManage={() => setPickingFav("book")}
        />
      ) : undefined,
    favmusic:
      summary.isOwner || (summary.favorites?.music?.length ?? 0) > 0 ? (
        <FavoritesCard
          kind="music"
          items={summary.favorites?.music ?? []}
          isOwner={summary.isOwner}
          hideTitle={c.hideCardTitles}
          onManage={() => setPickingFav("music")}
        />
      ) : undefined,
    badges: <BadgesRow badges={badges} onViewAll={() => setExpanded("badges")} handle={handle} />,
    activity: (
      <RecentActivity
        items={summary.isOwner || summary.activityPublic ? activity : []}
        onOpen={onOpenMeta}
        onViewAll={() => setExpanded("activity")}
        handle={handle}
        visibilityPrivate={!summary.isOwner && !summary.activityPublic}
        onOpenRatings={() => setShowRatings(true)}
      />
    ),
    comments: (
      <CommentsSection
        handle={handle}
        isOwner={summary.isOwner}
        signedIn={viewerSignedIn}
        onOpenAuthor={onOpenProfile}
      />
    ),
  };
  const presentCards = CARD_ORDER_DEFAULT.filter((k) => cardNodes[k] != null);
  const orderedCards = effectiveOrder(layout, presentCards);

  const heroSummary =
    summary.isOwner && watchedBreakdown.ready
      ? {
          ...summary,
          counts: {
            ...summary.counts,
            watched: Math.max(summary.counts.watched ?? 0, watchedBreakdown.watched),
            moviesWatched: watchedBreakdown.moviesWatched,
            episodesWatched: watchedBreakdown.episodesWatched,
            minutesWatched: watchedBreakdown.minutesWatched,
            hoursWatched: Math.floor(watchedBreakdown.minutesWatched / 60),
          },
        }
      : summary;

  return (
    <div
      ref={scrollRef}
      data-harbor-no-context-menu
      className="h-full overflow-y-auto"
      style={c.background ? { background: c.background } : undefined}
    >
      <ProfileHero
        p={heroSummary}
        avatar={heroAvatar}
        avatarFallback={heroAvatarFallback}
        mangaReadOverride={mangaReadCount}
        badges={badges}
        userFont={c.font}
        hideBanner={c.hideTopBanner}
        onEdit={() => setEditing(true)}
        onPatch={patchSummary}
      />
      <ScrollToTop targetRef={scrollRef} />

      <div className="mx-auto w-full max-w-6xl px-6 pb-16 lg:px-10">
        {locked ? (
          <div className="space-y-6">
            <ProfilePrivate alias={summary.alias} />
            <CommentsSection
              handle={handle}
              isOwner={summary.isOwner}
              signedIn={!!authKey}
              onOpenAuthor={onOpenProfile}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-6">
              {orderedCards.map((k, i) => {
                const isHidden = hiddenSet.has(k);
                if (isHidden && !arranging) return null;
                return (
                  <div key={k}>
                    {arranging && summary.isOwner && (
                      <ProfileCardControls
                        cardKey={k}
                        index={i}
                        total={orderedCards.length}
                        hidden={isHidden}
                        onMove={(dir) =>
                          applyLayout(moveCard(orderedCards, k, dir), [...hiddenSet])
                        }
                        onToggleHide={() => {
                          const h = new Set(hiddenSet);
                          if (h.has(k)) h.delete(k);
                          else h.add(k);
                          applyLayout(orderedCards, [...h]);
                        }}
                      />
                    )}
                    <div className={isHidden && arranging ? "opacity-40" : ""}>{cardNodes[k]}</div>
                  </div>
                );
              })}
            </div>
            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <ProfileAudioCard audioUrl={summary.audioUrl} />
              <MinecraftCard
                name={summary.minecraftName}
                background={summary.minecraftBg}
                hideTitle={c.hideCardTitles}
              />
              <WatchNowCard watching={summary.watching} />
              {summary.isOwner && settings.showSimklCard ? (
                <SimklCard isOwner hideTitle={c.hideCardTitles} published={summary.simkl} />
              ) : !summary.isOwner && summary.simkl ? (
                <SimklCard isOwner={false} hideTitle={c.hideCardTitles} published={summary.simkl} />
              ) : null}
              {summary.isOwner && settings.showLetterboxdCard ? (
                <LetterboxdCard
                  isOwner
                  hideTitle={c.hideCardTitles}
                  published={summary.letterboxd}
                />
              ) : !summary.isOwner && summary.letterboxd ? (
                <LetterboxdCard
                  isOwner={false}
                  hideTitle={c.hideCardTitles}
                  published={summary.letterboxd}
                />
              ) : null}
              <FriendsPanel
                friends={summary.isOwner || summary.friendsPublic ? friends : []}
                onOpen={onOpenProfile}
                isOwner={summary.isOwner}
                total={summary.counts.friends}
                visibilityPrivate={!summary.isOwner && !summary.friendsPublic}
              />
              <GroupsPanel isOwner={summary.isOwner} handle={handle} />
              <SocialsPanel
                socials={summary.socials}
                isOwner={summary.isOwner}
                onSaved={patchSummary}
              />
            </aside>
          </div>
        )}
        {expanded && (
          <ProfileViewAll
            section={expanded}
            lists={featuredLists ?? []}
            badges={badges}
            activity={activity}
            signedIn={viewerSignedIn}
            isOwner={summary.isOwner}
            handle={handle}
            onOpenMeta={onOpenMeta}
            onClose={() => setExpanded(null)}
          />
        )}
        {pickingLists && (
          <MyListsPicker
            onClose={() => {
              setPickingLists(false);
              reload();
            }}
          />
        )}
        {pickingFav && (
          <FavoritesPicker
            kind={pickingFav}
            initial={{
              game: summary.favorites?.game ?? [],
              book: summary.favorites?.book ?? [],
              music: summary.favorites?.music ?? [],
            }}
            onClose={() => setPickingFav(null)}
            onSaved={patchSummary}
          />
        )}
        {showRatings && (
          <UserRatings
            handle={handle}
            alias={summary.alias}
            onOpenMeta={onOpenMeta}
            onClose={() => setShowRatings(false)}
          />
        )}
        {importingRatings && (
          <ImportModal
            onClose={() => {
              setImportingRatings(false);
              reload();
            }}
          />
        )}
      </div>

      {arranging && summary.isOwner && (
        <div className="pointer-events-none fixed inset-x-0 bottom-7 z-[130] flex justify-center px-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-elevated/95 py-2 pe-2 ps-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] ring-1 ring-edge-soft backdrop-blur-md">
            <span className="text-[13px] text-ink-muted">{t("Move or hide your cards")}</span>
            <button
              onClick={() => {
                setArranging(false);
                setEditing(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Check size={15} strokeWidth={2.6} /> {t("Save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
