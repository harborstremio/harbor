import type { ThemeSettings } from "@/lib/theme";
import type { CustomList } from "@/lib/lists/types";
import type { SourceRow } from "@/lib/custom-sources";

export type StreamingService =
  | "netflix"
  | "disney"
  | "hulu"
  | "prime"
  | "apple"
  | "max"
  | "paramount"
  | "peacock"
  | "crunchyroll";

export type WebhookTrigger =
  | { event: "newMovie" }
  | { event: "newSeries" }
  | { event: "newAnime" }
  | { event: "fromTrackedPerson"; personIds?: number[] }
  | { event: "fromGenre"; genreIds: number[]; mediaType: "movie" | "tv" }
  | { event: "fromProvider"; providerIds: number[] }
  | { event: "fromCountry"; countryCodes: string[] }
  | { event: "fromTraktAnticipated" }
  | { event: "fromTraktWatchlist" }
  | {
      event: "liveTvEvent";
      channelIds?: string[];
      favoritesOnly?: boolean;
      leadMinutes?: number;
    };

export type ContentCategory = "anime" | "liveTv" | "sports" | "adult";

export type ContentFilters = Record<ContentCategory, boolean>;

export type Settings = {
  translatePosters: boolean;
  blurComments: boolean;
  blurEpisodes: boolean;
  tmdbKey: string;
  omdbKey: string;
  rpdbKey: string;
  fanartKey: string;
  tvdbKey: string;
  rdKey: string;
  tbKey: string;
  adKey: string;
  pmKey: string;
  dlKey: string;
  region: string;
  preferredLanguages: string[];
  requirePreferredLanguage: boolean;
  showImdbBadge: boolean;
  showTmdbBadge: boolean;
  showRtBadge: boolean;
  showMalBadge: boolean;
  showMetacriticBadge: boolean;
  showLetterboxdBadge: boolean;
  showMdblistBadge: boolean;
  showTraktBadge: boolean;
  showTraktComments: boolean;
  cardBadgeLimit: number;
  showQualityBadge: boolean;
  showCardBadges: boolean;
  homeLanguages: string[];
  posterScale: number;
  posterRadius: number;
  posterEffect: "blur" | "fade" | "off";
  rowTitleScale: number;
  playerTitleScale: number;
  playerTitleSeriesFirst: boolean;
  uiScale: number;
  serveWebUi: boolean;
  trailerQuality: "auto" | "360p" | "720p" | "1080p" | "best";
  detailTrailerAutoplay: boolean;
  heroShadow: number;
  heroFull: boolean;
  heroFullQuality: boolean;
  resumePrompt: boolean;
  resumePlayback: boolean;
  badgePlacement: "top" | "bottom";
  watchlistBadge: "off" | "topStart" | "topEnd" | "bottomStart" | "bottomEnd";
  showWatchedButton: boolean;
  showPopcornBadge: boolean;
  episodeLayout: "list" | "strip" | "grid";
  episodeSort: "oldest" | "newest";
  showEpisodeRating: boolean;
  showEpisodeDescription: boolean;
  hdEpisodeImages: boolean;
  harborAvatar: string | null;
  harborColor: string;
  anilistAutoSync: boolean;
  useAnilistAvatar: boolean;
  useTraktAvatar: boolean;
  useSimklAvatar: boolean;
  traktClientId: string;
  traktClientSecret: string;
  traktAccessToken: string | null;
  traktRefreshToken: string | null;
  traktExpiresAt: number;
  traktUsername: string | null;
  streaming: Record<StreamingService, boolean>;
  showAdultAddons: boolean;
  togetherRelayUrl: string;
  togetherCfToken: string;
  togetherCfAccountId: string;
  togetherCfDeployed: boolean;
  togetherShareCursors: boolean;
  togetherGuestsPick: boolean;
  discordRichPresence: boolean;
  discordHideTitle: boolean;
  discordShowWhenPaused: boolean;
  discordShowWhenBrowsing: boolean;
  discordShowPoster: boolean;
  discordShowTimestamp: boolean;
  discordShowPartyJoin: boolean;
  playerEngine: "auto" | "html5" | "mpv";
  playerShellId: string;
  playerChromeTheme: "auto" | "default" | "stremio";
  seekPreviewEnabled: boolean;
  instantPlay: boolean;
  rememberLastStream: boolean;
  keepSourceNextEpisode: boolean;
  playerHdrToSdr: boolean;
  playerMotionInterp: boolean;
  playerAnime4k: boolean;
  playerAnime4kAnimeOnly: boolean;
  playerAnime4kIndicator: boolean;
  playerMpvEmbed: boolean;
  playerP2pChip: boolean;
  showQualityInfo: boolean;
  stremioServerTranscode: boolean;
  directTorrentStream: boolean;
  p2pAutoConsent: boolean;
  streamCacheRetentionHours: number;
  streamCacheDir: string;
  remoteStreamServerUrl: string;
  remoteStreamServerStrict: boolean;
  castAlwaysTranscode: boolean;
  playerAnime4kShaders: string[];
  playerAnime4kMode: string;
  playerAnime4kTier: string;
  playerAnime4kFolder: string;
  playerAnime4kOverride: string;
  preferredSubLangs: string[];
  preferredAudioLangs: string[];
  subFontSize: number;
  subFontColor: string;
  subBorderColor: string;
  subBorderSize: number;
  subMarginY: number;
  subAlignX: "left" | "center" | "right";
  subAssOverride: "no" | "yes" | "force" | "scale" | "strip";
  subStyle: "shadow" | "outline" | "box";
  subFontFamily: string;
  subBold: boolean;
  customFonts: Array<{
    id: string;
    name: string;
    dataUrl: string;
    format: string;
  }>;
  subBoxOpacity: number;
  subBoxColor: string;
  subOpacity: number;
  subLineSpacing: number;
  subProvidersEnabled: {
    wyzie: boolean;
    opensubtitles: boolean;
    jimaku: boolean;
    addons: boolean;
  };
  subShowInPip: boolean;
  subtitlesOffByDefault: boolean;
  preferEmbeddedSubs: boolean;
  betaUpdates: boolean;
  autoSkipIntro: boolean;
  autoSkipAd: boolean;
  trackBlockWords: string[];
  forcedSubsWhenNativeAudio: boolean;
  tmdbLanguage: string;
  posterBaseUrl: string;
  hidePosterTitles: boolean;
  hoverPreview: boolean;
  hoverPreviewPlacement: "over" | "side";
  mdblistKey: string;
  aiSearchKey: string;
  aiSearchModel: string;
  playerD3d11Flip: boolean;
  mpvExtraOptions: string;
  mpvQuality: "balanced" | "performance" | "quality";
  mpvHwdec: "auto" | "on" | "off";
  mpvBufferBoost: boolean;
  mpvDownmixStereo: boolean;
  mpvTweaks: Record<string, string>;
  playerSvp: boolean;
  svpVpyPath: string;
  svpScope: "all" | "anime" | "non-anime";
  playerHdrOpaqueWindow: boolean;
  playerEscExitsFullscreen: boolean;
  playerHdrStage: "auto" | "off" | "always";
  opensubtitlesApiKey: string;
  jimakuToken: string;
  audioNormalize: boolean;
  audioProfile: "off" | "bass" | "voice" | "bass-reduce" | "night";
  bandwidthMbps: number;
  nextEpisodeLeadSec: number;
  autoPlayNextEpisode: boolean;
  hideWatchedInCatalogs: boolean;
  showPlaylistsTab: boolean;
  sportsLeagues: string[];
  hideSpoilers: boolean;
  spoilerHideThumbnails: boolean;
  spoilerHideTitles: boolean;
  spoilerHideDescriptions: boolean;
  spoilerSkipNext: boolean;
  streamBackdropBlur: boolean;
  hideContent: ContentFilters;
  theme: ThemeSettings;
  homeMode: "harbor" | "classic";
  homeShowAllAddonRows: boolean;
  libraryBookmarkedOnly: boolean;
  librarySort: "recent" | "title" | "year";
  preferCustomMetaAddon: boolean;
  animeOnlyInAnimeRoom: boolean;
  cwAdvanceNext: boolean;
  useNativeTitleBar: boolean;
  closeToTray: boolean;
  trayAlwaysOnTop: boolean;
  pauseMinimized: boolean;
  pauseUnfocused: boolean;
  cwSnapshotRetentionDays: number;
  streamFilterLevel: "strict" | "balanced" | "off";
  blockTrackers: boolean;
  homeRows: {
    order: string[];
    hidden: string[];
    renamed: Record<string, string>;
    numerals: string[];
    heroSource: string | null;
    customSources: SourceRow[];
  };
  hotkeys: Record<string, string>;
  animeFavoriteGenres: number[];
  animePicksDismissedAt: number;
  animeAnilistRowsHidden: string[];
  pickerLayout: "condensed" | "stremio";
  streamSort: "harbor" | "addon";
  fullStreamDescription: boolean;
  pickerShowFilename: boolean;
  seekBarStyle: "flat" | "glass" | "pinstripe" | "rainbow" | "image";
  seekBarHeight: number;
  seekBarColor: string;
  seekBarImage: string;
  seekDotShape: "circle" | "square" | "image" | "hidden";
  seekDotSize: number;
  seekDotImage: string;
  customCss: string;
  customJs: string;
  customHtml: string;
  webhooks: {
    discordUrl: string;
    telegramUrl: string;
    notifyMovies: boolean;
    notifyTv: boolean;
    notifyAnime: boolean;
    sources: {
      library: boolean;
      all: boolean;
      trakt: boolean;
      anticipated: boolean;
      custom: boolean;
    };
  };
  calendarSource:
    | "library"
    | "all"
    | "trakt"
    | "anticipated"
    | "custom"
    | "simkl"
    | "simkl-anticipated";
  weekStartsMonday: boolean;
  customCalendar: {
    trackedPeople: Array<{
      id: number;
      name: string;
      profile?: string | null;
      role: "any" | "acting" | "directing";
    }>;
    includeTraktWatchlist: boolean;
    includeTraktAnticipated: boolean;
    genres: Array<{ id: number; name: string; mediaType: "movie" | "tv" }>;
    watchProviders: Array<{ id: number; name: string }>;
    originCountries: string[];
    mediaTypes: { movie: boolean; tv: boolean; anime: boolean };
  };
  webhookRules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    trigger: WebhookTrigger;
    channels: { discord: boolean; telegram: boolean };
  }>;
  downloadDir: string;
  stremioDeeplinkInstall: boolean;
  iptvPlaylists: Array<{
    id: string;
    name: string;
    url: string;
    epgUrl?: string;
    kind?: "m3u" | "xtream" | "epg";
    xtream?: {
      server: string;
      username: string;
      password: string;
    };
  }>;
  iptvLiveContainer: "ts" | "m3u8";
  iptvForceProxy: boolean;
  iptvEpgOffsetHours: number;
  sidebarCollapsed: boolean;
  feedLocaleBias: boolean;
  uiLanguage: "en" | "ar";
  arabicWelcomeSeen: boolean;
  cropMode: string;
  customLists: CustomList[];
  pauseListStatusOnPause: boolean;
  translateTitles: boolean;
  translateDescriptions: boolean;
  adSkipEnabled: boolean;
  adReportAlwaysShow: boolean;
  adReportFirstSeen: boolean;
};
