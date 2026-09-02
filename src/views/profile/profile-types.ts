import type { FeaturedList } from "@/lib/social/featured-lists";
import type { SocialKey } from "@/lib/social/socials";
import type { RatingsSummary } from "@/lib/ratings/types";
import type { FavoriteMedia } from "@/lib/providers/favorites-types";
import type { PresenceStatus } from "@/lib/social/presence";

export type SocialEntry = { service: SocialKey; value: string };

export type ResolvedSocial = SocialEntry & {
  label: string;
  brand: string;
  url: string | null;
  iconPath: string;
};

export type BadgeTier = "bronze" | "silver" | "gold" | "prismatic";

export type ShowcaseItem = {
  kind: "favorite" | "top-genre" | "pinned" | "theme";
  title: string;
  posterUrl?: string;
  caption?: string;
  metaId?: string;
  themeId?: string;
  swatch?: string[];
  downloads?: number;
  ratingAvg?: number;
  ratingCount?: number;
};

export type ProfileCounts = {
  watched: number;
  moviesWatched?: number;
  episodesWatched?: number;
  friends: number;
  badges: number;
  hoursWatched: number;
  minutesWatched?: number;
  mangaRead?: number;
};

export type ProfileWatching = {
  kind: "watching" | "party";
  title?: string;
  metaId?: string;
  metaType?: string;
  sub?: string;
  posterUrl?: string;
  partySize?: number;
  paused?: boolean;
  startedAt?: number;
  positionSec?: number;
  positionAt?: number;
  durationSec?: number;
};

export type FriendsVisibility = "everyone" | "friends" | "only_me";

export type ProfileSummary = {
  handle: string;
  alias: string;
  avatarUrl?: string;
  bannerUrl?: string;
  verified: boolean;
  featured: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  slogan?: string;
  description?: string;
  location?: string;
  pronouns?: string;
  customUrl?: string;
  online: boolean;
  presence?: PresenceStatus;
  watching?: ProfileWatching;
  memberSince: string;
  counts: ProfileCounts;
  showcase?: ShowcaseItem;
  ratings?: RatingsSummary;
  cardLayout?: { order?: string[]; hidden?: string[] };
  statLayout?: { hidden?: string[] };
  featuredLists?: FeaturedList[];
  favorites?: {
    game?: FavoriteMedia[];
    book?: FavoriteMedia[];
    music?: FavoriteMedia[];
  };
  simkl?: SimklPublished | null;
  socials?: ResolvedSocial[];
  audioUrl?: string;
  minecraftName?: string;
  minecraftBg?: string;
  shownBadges?: string[];
  hideVerified?: boolean;
  isOwner: boolean;
  friendStatus?: "none" | "friends" | "outgoing" | "incoming" | "blocked";
  friendEdgeId?: string;
  activityPublic?: boolean;
  shareActivity?: boolean;
  friendsPublic?: boolean;
  friendsVisibility?: FriendsVisibility;
  private?: boolean;
  customEnabled?: boolean;
  profileFont?: string;
  profileFavicon?: string;
  pageBgColor?: string;
  pageBgImage?: string;
  customHtml?: string;
  customCss?: string;
  canvasHeight?: number;
  hideTopBanner?: boolean;
  hideCardTitles?: boolean;
};

export type SimklPublished = {
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  profileUrl: string | null;
  accountType: string | null;
  stats: {
    moviesCompleted: number;
    showsCompleted: number;
    totalCompleted: number;
    lastWatchedAt: string | null;
  } | null;
};

export type Friend = {
  handle: string;
  alias: string;
  avatarUrl?: string;
  slogan?: string;
  online: boolean;
  presence?: PresenceStatus;
  status?: string;
  mutual?: boolean;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  tier: BadgeTier;
  rarityPct?: number;
  unlockedAt?: string;
};

export type ActivityKind = "watched" | "finished" | "rated" | "favorited" | "imported";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  posterUrl?: string;
  subtitle?: string;
  rating?: number;
  at: string;
  metaId?: string;
};

export type Comment = {
  id: string;
  parentId?: string;
  authorHandle: string;
  authorAlias: string;
  authorVerified?: boolean;
  authorAvatarUrl?: string;
  body: string;
  at: string;
  likeCount?: number;
  liked?: boolean;
  flagged?: boolean;
  edited?: boolean;
};

export type CommentPage = {
  total?: number;
  comments: Comment[];
  nextCursor?: string;
};

export type ProfileSettingsInput = {
  alias: string;
  audioUrl: string;
  minecraftName: string;
  minecraftBg: string;
  description: string;
  location: string;
  pronouns: string;
  customUrl: string;
  slogan: string;
  shareActivity: boolean;
  friendsVisibility: FriendsVisibility;
  private: boolean;
};

export type CustomizationInput = {
  profileFont: string;
  profileFavicon: string;
  pageBgColor: string;
  pageBgImage: string;
  customHtml: string;
  customCss: string;
  canvasHeight: number;
  customEnabled: boolean;
  hideTopBanner: boolean;
  hideCardTitles: boolean;
};

export type LoadState = "loading" | "ready" | "error" | "empty";
