import type { ThemeSettings } from "@/lib/theme";
import type { CustomList } from "@/lib/lists/types";
import type { SourceRow } from "@/lib/custom-sources";
import type { CustomStreamFilter } from "@/lib/streams/custom-filters";
import type { UiLanguage } from "@/lib/i18n";

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
  | { event: "liveTvEvent"; channelIds?: string[]; favoritesOnly?: boolean; leadMinutes?: number };

export type ContentCategory = "anime" | "liveTv" | "sports" | "adult";

export type ContentFilters = Record<ContentCategory, boolean>;
export type LetterboxdSettings = {
  enabled: boolean;
  mode: "public" | "full";
  username: string;
  encodedConfig: string;
  selectedCatalogs: string[];
  hiddenCatalogs: string[];
  catalogOrder: string[];
  showRatingsOnPosters: boolean;
  listRefs: Array<{ id: string; name: string; owner?: string; filmCount?: number }>;
};

export interface SimklGranularFilters {
  movies: {
    plantowatch: boolean;
  };
  shows: {
    watching: boolean;
    plantowatch: boolean;
  };
  anime: {
    watching: boolean;
    plantowatch: boolean;
  };
}

export type Settings = {
  soundTheme: "none" | "glass" | "modern" | "retro" | "cinematic";
  sfxVolume: number;
  playerVolumeSfx: boolean;
  experimentalLiquidGlassEnabled: boolean;
  experimentalLiquidGlassOpacity: number;
  defaultLiquidGlassBlur: number;
  defaultLiquidGlassTint: number;
  posterDockMagnification: boolean;
  blurComments: boolean;
  blurEpisodes: boolean;
  tmdbKey: string;
  omdbKey: string;
  rpdbKey: string;
  imdbApiFallback: boolean;
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
  animeCardRating: "mal" | "imdb";
  showMetacriticBadge: boolean;
  showLetterboxdBadge: boolean;
  showMdblistBadge: boolean;
  showTraktBadge: boolean;
  showDetailRatings: boolean;
  showImdbDetail: boolean;
  showTmdbDetail: boolean;
  showMalDetail: boolean;
  showRtDetail: boolean;
  showRtAudienceDetail: boolean;
  showLetterboxdDetail: boolean;
  showMetacriticDetail: boolean;
  showTraktDetail: boolean;
  showMdblistDetail: boolean;
  showTraktComments: boolean;
  showSimklBadge: boolean;
  showDubBadge: boolean;
  simklShowCommunityRatings: boolean;
  simklEnableUserRatings: boolean;
  simklGranularFilters: SimklGranularFilters;
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
  remoteControlEnabled: boolean;
  trailerQuality: "auto" | "360p" | "720p" | "1080p" | "best";
  detailTrailerAutoplay: boolean;
  heroBackdropCarousel: boolean;
  detailTrailerAudio: boolean;
  heroShadow: number;
  heroFull: boolean;
  heroFullQuality: boolean;
  resumePrompt: boolean;
  resumePlayback: boolean;
  keepFullscreenOnExit: boolean;
  fullscreenRestorePosition: boolean;
  contentAdvisoryToast: boolean;
  playerVolumeHud: boolean;
  playerVolumeHudPosition: "center" | "top" | "top-left" | "top-right";
  customPlaybackSpeeds: number[];
  customSleepMinutes: number[];
  badgePlacement: "top" | "bottom";
  watchlistBadge: "off" | "topStart" | "topEnd" | "bottomStart" | "bottomEnd";
  showWatchedButton: boolean;
  showPopcornBadge: boolean;
  episodeLayout: "list" | "strip" | "grid";
  episodeSort: "oldest" | "newest";
  showEpisodeRating: boolean;
  showEpisodeDescription: boolean;
  hdEpisodeImages: boolean;
  episodeArcGroups: boolean;
  episodeOrderProvider: "default" | "tmdb" | "tvdb";
  tvdbSeasonType:
    | "aired"
    | "official"
    | "dvd"
    | "absolute"
    | "tvdbabsolute"
    | "alternate"
    | "regional";
  tvdbOrderPanel: boolean;
  tvdbPin: string;
  harborAvatar: string | null;
  harborColor: string;
  anilistAutoSync: boolean;
  malAutoSync: boolean;
  anilistBlurComments: boolean;
  showAnilistComments: boolean;
  useAnilistAvatar: boolean;
  useTraktAvatar: boolean;
  useSimklAvatar: boolean;
  useMalAvatar: boolean;
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
  playerMenuBlack: boolean;
  seekPreviewEnabled: boolean;
  instantPlay: boolean;
  seasonSourceLock: boolean;
  rememberLastStream: boolean;
  keepSourceNextEpisode: boolean;
  playerHdrToSdr: boolean;
  playerRtxHdr: boolean;
  playerMacEdr: boolean;
  playerDisplayPanel: "auto" | "oled" | "lcd";
  playerMotionInterp: boolean;
  playerAnime4k: boolean;
  playerAnime4kAnimeOnly: boolean;
  playerAnime4kIndicator: boolean;
  playerMpvEmbed: boolean;
  playerP2pChip: boolean;
  showQualityInfo: boolean;
  stremioServerTranscode: boolean;
  directTorrentStream: boolean;
  torrentsDisabled: boolean;
  torrentFullDownload: boolean;
  p2pAutoConsent: boolean;
  streamCacheRetentionHours: number;
  streamCacheMaxGb: number;
  deleteWatchedDownloads: boolean;
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
  customFonts: Array<{ id: string; name: string; format: string; dataUrl?: string }>;
  subBoxOpacity: number;
  subBoxColor: string;
  subOpacity: number;
  subLineSpacing: number;
  subProvidersEnabled: { wyzie: boolean; opensubtitles: boolean; jimaku: boolean; addons: boolean };
  subShowInPip: boolean;
  subtitleAutoSync: boolean;
  subtitlesOffByDefault: boolean;
  preferEmbeddedSubs: boolean;
  subtitleAutoUpgrade: boolean;
  subtitlePreselect: boolean;
  betaUpdates: boolean;
  autoSkipIntro: boolean;
  autoSkipRecap: boolean;
  autoSkipOutro: boolean;
  autoSkipAd: boolean;
  showSkipButton: boolean;
  skipButtonHideSec: number;
  trackBlockWords: string[];
  forcedSubsWhenNativeAudio: boolean;
  tmdbLanguage: string;
  tmdbImageLangs: string[];
  nfoPosterSize: string;
  nfoBackdropSize: string;
  nfoLogoSize: string;
  showLocalLibraryBadge: boolean;
  localPlaybackMode: "ask" | "local" | "stream";
  localMinFileSizeMb: number;
  catalogsPinned: string[];
  catalogsHidden: string[];
  posterBaseUrl: string;
  hidePosterTitles: boolean;
  hoverPreviewEnabled: boolean;
  hoverPreviewPlacement: "over" | "side";
  cardHoverStyle: "none" | "default" | "elegant" | "frosted" | "cinema" | "spotlight" | "custom";
  customHoverId: string;
  mdblistKey: string;
  auddKey: string;
  aiSearchKey: string;
  aiSearchModel: string;
  aiGroqKey: string;
  jinaKey: string;
  aiWebSearch: boolean;
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
  seekBackStepSec: number;
  seekForwardStepSec: number;
  playerHdrOpaqueWindow: boolean;
  playerEscExitsFullscreen: boolean;
  playerConfirmLeave: boolean;
  tvNavigation: boolean;
  playerTvNavigation: boolean;
  playerHdrStage: "auto" | "off" | "always";
  opensubtitlesApiKey: string;
  jimakuToken: string;
  audioNormalize: boolean;
  audioProfile: "off" | "bass" | "voice" | "bass-reduce" | "night";
  audioDevice: string;
  bandwidthMbps: number;
  nextEpisodeLeadSec: number;
  autoPlayNextEpisode: boolean;
  keyboardPauseShowsControls: boolean;
  hideWatchedInCatalogs: boolean;
  hideUnreleased: boolean;
  localEpisodeSortDesc: boolean;
  showPlaylistsTab: boolean;
  skipProfileScreen: boolean;
  profilePromptInterval: "launch" | "15m" | "30m" | "never";
  defaultProfileId: string;
  sportsLeagues: string[];
  hideSpoilers: boolean;
  spoilerHideThumbnails: boolean;
  spoilerHideTitles: boolean;
  spoilerHideDescriptions: boolean;
  spoilerSkipNext: boolean;
  streamBackdropBlur: boolean;
  songIdEnabled: boolean;
  songCardStyle: "compact" | "cinematic";
  songCardDetails: boolean;
  hideContent: ContentFilters;
  theme: ThemeSettings;
  customLogoMark: string;
  customLogoWordmark: string;
  customAppIcon: string;
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
  cwSnapshotFullQuality: boolean;
  streamFilterLevel: "strict" | "balanced" | "off";
  blockTrackers: boolean;
  homeRows: {
    order: string[];
    hidden: string[];
    renamed: Record<string, string>;
    numerals: string[];
    heroSource: string | null;
    customSources: SourceRow[];
    listRows?: string[];
  };
  navCustomization: {
    order: string[];
    hidden: string[];
    renamed: Record<string, string>;
  };
  hotkeys: Record<string, string>;
  animeFavoriteGenres: number[];
  animeExcludeOrigins: string[];
  animeHideWatchedPicks: boolean;
  animePicksDismissedAt: number;
  animeAnilistRowsHidden: string[];
  animeMalRowsHidden: string[];
  pickerLayout: "condensed" | "stremio";
  streamSort: "harbor" | "addon";
  fullStreamDescription: boolean;
  pickerShowFilename: boolean;
  pickerRefreshNextToBack: boolean;
  customStreamFilters: CustomStreamFilter[];
  seekBarStyle: "flat" | "glass" | "pinstripe" | "rainbow" | "image";
  seekBarHeight: number;
  seekBarColor: string;
  seekBarImage: string;
  seekBarFill: boolean;
  seekBarFillOpacity: number;
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
  simklHomeRailsEnabled: boolean;
  simklUpNextRailEnabled: boolean;
  simklTrendingRailEnabled: boolean;
  simklScrobbleEnabled: boolean;
  simklAnimeTitleLanguage: "english" | "romaji" | "native";
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
  downloadCreateFolders: boolean;
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
  wrappedButton: boolean;
  feedLocaleBias: boolean;
  uiLanguage: UiLanguage;
  cropMode: string;
  customLists: CustomList[];
  pauseListStatusOnPause: boolean;
  translateTitles: boolean;
  translateDescriptions: boolean;
  letterboxd: LetterboxdSettings;
  adSkipEnabled: boolean;
  adReportAlwaysShow: boolean;
  adReportFirstSeen: boolean;
};
