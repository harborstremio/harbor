import jlMediaVision from "./en/jl-media-vision";
import playOrders from "./en/play-orders";
import gameRomLibrary from "./en/game-rom-library";
import gameNotes from "./en/game-notes";
import gameLibraryRefinements from "./en/game-library-refinements";
import gamePokemonUi from "./en/game-pokemon-ui";
import customArtwork from "./en/custom-artwork";
import gameAtlasDiscovery from "./en/game-atlas-discovery";
import gameDiscoveryPicker from "./en/game-discovery-picker";
import gameLibraryManagement from "./en/game-library-management";
import gameHydraImport from "./en/game-hydra-import";
import gameStudioCatalog from "./en/game-studio-catalog";
import gameArtwork from "./en/game-artwork";
import gameMetadataMatching from "./en/game-metadata-matching";
import gameAgeRatings from "./en/game-age-ratings";
import gameLibraryLinks from "./en/game-library-links";
import gameModHub from "./en/game-mod-hub";
import gameLibraryTitles from "./en/game-library-titles";
import gameStoreSearch from "./en/game-store-search";
import gameSteamShortcuts from "./en/game-steam-shortcuts";
import gameGallery from "./en/game-gallery";
import gameStardew from "./en/game-stardew";
import gameSourceAlerts from "./en/game-source-alerts";
import gamePokemon from "./en/game-pokemon";
import gameSims from "./en/game-sims";
import gameTarkov from "./en/game-tarkov";
import gameTft from "./en/game-tft";
import gameEve from "./en/game-eve";
import gameOsrs from "./en/game-osrs";
import gameFfxiv from "./en/game-ffxiv";
import gameFortnite from "./en/game-fortnite";
import gameSetup from "./en/game-setup";
import torrentDialog from "./en/torrent-dialog";
import gameDownloadNotifications from "./en/game-download-notifications";
import gameDownloadCenter from "./en/game-download-center";
import warhammerUniverse from "./en/warhammer-universe";
import gameValorant from "./en/game-valorant";
import gameAudience from "./en/game-audience";
import gameDetailFlow from "./en/game-detail-flow";
import gameWowTalents from "./en/game-wow-talents";
import gameWowProgress from "./en/game-wow-progress";
import gameWowRuns from "./en/game-wow-runs";
import gamePlaytime from "./en/game-playtime";
import gameLaunchHealth from "./en/game-launch-health";
import gameUnifiedLibrary from "./en/game-unified-library";
import gameDota from "./en/game-dota";
import gameLeague from "./en/game-league";
import gameOverwatch from "./en/game-overwatch";
import gameWowEquipment from "./en/game-wow-equipment";
import gameRecommendations from "./en/game-recommendations";
import gameOwnedDiscovery from "./en/game-owned-discovery";
import gameBackups from "./en/game-backups";
import gameArchives from "./en/game-archives";
import gameSourceDiscovery from "./en/game-source-discovery";
import gameGuides from "./en/game-guides";
import gameModUpdates from "./en/game-mod-updates";
import gameMinecraft from "./en/game-minecraft";
import gameRoms from "./en/game-roms";
import gameExploreRows from "./en/game-explore-rows";
import gameHackDiscovery from "./en/game-hack-discovery";
import gameHub from "./en/game-hub";
import floatingPlayer from "./en/floating-player";
import gameAntiCheat from "./en/game-anti-cheat";
import gameDock from "./en/game-dock";
import gameCompanion from "./en/game-companion";
import gameWow from "./en/game-wow";
import gameSearch from "./en/game-search";
import mediaStart from "./en/media-start";
import spooktober from "./en/spooktober";
import music from "./en/music";
import games from "./en/games";
import gamePlayer from "./en/game-player";
import gameDiscovery from "./en/game-discovery";
import gameDetails from "./en/game-details";
import gameAchievements from "./en/game-achievements";
import settingsRefinements from "./en/settings-refinements";

import nytTv from "./en/nyt-tv";
import curatedLists from "./en/curated-lists";
import filmRegistry from "./en/film-registry";
import personCraft from "./en/person-craft";
import country from "./en/country";
import adaptation from "./en/adaptation";
import production from "./en/production";
import criticism from "./en/criticism";
import soundtrack from "./en/soundtrack";

const en: Record<string, string> = {
  "collections.feed.more": "Load more collections",
  "collections.feed.error": "Couldn't load collections. Try again.",
  ...gamePokemon,
  ...torrentDialog,
  ...gameAudience,
  ...gameUnifiedLibrary,
  ...gameStoreSearch,
  ...gameLibraryTitles,
  ...gameLibraryLinks,
  ...gameHub,
  ...floatingPlayer,
  ...gameAntiCheat,
  "sports.guide.athletes": "Athletes",
  "sports.guide.athlete": "Athlete",
  "sports.guide.athleteCount": "{n} athletes",
  "sports.guide.athleteIntro": "Athletes from published events and standings.",
  "sports.guide.viewAthletes": "View all athletes",
  "sports.guide.searchAthletes": "Search athletes",
  "sports.guide.noAthleteMatch": "No athletes match your search.",
  "sports.guide.noAthletes": "This feed has not published an athlete list.",
  "sports.boxing.wins": "Wins",
  "sports.boxing.losses": "Losses",
  "sports.boxing.draws": "Draws",
  "sports.boxing.knockouts": "KOs",
  "sports.boxing.tba": "Fighter to be announced",
  "Translations": "Translations",
  "Translating…": "Translating…",
  "Showing {lang}": "Showing {lang}",
  "Show all": "Show all",
  "games.download.queueOrder": "Queue order {position}",
  "games.download.earlier": "Move {name} earlier",
  "games.download.later": "Move {name} later",
  ...mediaStart,
  ...spooktober,
  ...videoCast,
  ...music,
  ...games,
  ...gamePlaytime,
  ...gameLaunchHealth,
  ...gamePlayer,
  ...gameDiscovery,
  ...gameDetails,
  ...gameAchievements,
  ...gameSearch,
  ...gameDock,
  ...gameCompanion,
  ...gameFortnite,
  ...gameFfxiv,
  ...gameOsrs,
  ...gameTarkov,
  ...gameModHub,
  ...gameSims,
  ...gameStardew,
  ...gameTft,
  ...gameEve,
  ...warhammerUniverse,
  ...gameWow,
  Soccer: "Football",
  "Build identity. Useful when filing a bug report.":
    "Build identity. Useful when filing a bug report.",
  "nav.home": "Home",
  "nav.discover": "Discover",
  "nav.catalogs": "Catalogs",
  "nav.plugins": "Plugins",
  "nav.movies": "Movies",
  "nav.shows": "Shows",
  "nav.people": "Top People",
  "nav.kids": "Watch",
  "nav.anime": "Anime",
  "nav.manga": "Manga",
  "nav.ebook": "eBook",
  "nav.live": "Live TV",
  "nav.sports": "Sports",
  "nav.playlists": "Playlists",
  "nav.calendar": "Calendar",
  "nav.library": "My Library",
  "nav.downloads": "Downloads",
  "nav.addons": "Addons",
  "nav.settings": "Settings",
  "nav.collections": "Collections",
  "nav.arabic": "العربية",

  "common.search": "Search",
  "common.back": "Back",
  "common.play": "Play",
  "common.close": "Close",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.remove": "Remove",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.done": "Done",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.loading": "Loading",
  "common.retry": "Retry",
  "common.more": "More",

  "search.placeholder": "Search movies, shows, people…",

  "chrome.minimize": "Minimize",
  "chrome.maximize": "Maximize",
  "chrome.restore": "Restore",
  "chrome.watchTogether": "Watch together",
  "chrome.scrollForMore": "Scroll for more",
  "chrome.backToTop": "Back to top",
  "chrome.locked": "Locked",
  "chrome.parentalOn": "Parental controls on",
  "chrome.lockedRequiresPin": "{label} (locked, requires PIN)",
  "chrome.lockedShort": "{label} · locked",
  "chrome.harborHome": "Harbor home",
  "chrome.sectionLibrary": "Library",

  "profile.whoWatching": "Who's watching",
  "profile.editThis": "Edit this profile",
  "profile.new": "New profile",
  "profile.signOut": "Sign out of Stremio",
  "profile.signIn": "Sign in to Stremio",
  "profile.switch": "Switch profile",
  "profile.primary": "Primary",
  "profile.signedIn": "Signed in to Stremio",
  "profile.fallback": "Profile",

  "welcome.title": "Welcome to Harbor",
  "welcome.subtitle": "The interface is now in Arabic. You can switch back anytime from Settings.",
  "welcome.dismiss": "Get started",

  "arabic.hub.title": "Arabic",
  "arabic.row.ramadan": "Ramadan 2026 Series",
  "arabic.row.drama": "Arabic Drama",
  "arabic.row.movies": "Arabic Movies",
  "arabic.row.classics": "Egyptian Cinema Classics",
  "arabic.row.khaleeji": "Gulf / Khaleeji",
  "arabic.row.comedy": "Arabic Comedy",
  "arabic.row.trending": "Trending in Arabic",

  // Sports customization

  // Episode Detail Page
  "Episode Not Found": "Episode Not Found",
  "Episode information is not available": "Episode information is not available.",
  "Unable to connect": "Unable to connect",
  Stills: "Stills",
  "Guest Stars": "Guest Stars",
  "Guest Stars · {n}": "Guest Stars · {n}",
  Overview: "Overview",
  "Go Back": "Go Back",
  Retry: "Retry",
  "Loading episode details...": "Loading episode details...",
  "View Series": "View Series",
  "Play Episode": "Play Episode",
  min: "min",
  "Episode {n}": "Episode {n}",
  "{n} min": "{n} min",
  "Unable to load series information": "Unable to load series information",
  "An unexpected error occurred": "An unexpected error occurred",
  "TMDB Rating": "TMDB Rating",
  Votes: "Votes",
  "Air Date": "Air Date",
  Runtime: "Runtime",

  My: "My",
  "Reveal comments": "Reveal comments",
  "Comments are hidden": "Comments are hidden",
  "You haven't commented yet": "You haven't commented yet",
  "Reveal image": "Reveal image",
  "Trakt Comments": "Trakt Comments",
  "Open on Trakt": "Open on Trakt",

  "AniList Comments": "AniList Comments",
  "Connect your AniList account to see forum threads and comments.":
    "Connect your AniList account to see forum threads and comments.",
  "Connect AniList": "Connect AniList",
  "Could not find this title on AniList.": "Could not find this title on AniList.",
  "New thread": "New thread",
  "Back to threads": "Back to threads",
  "Thread title": "Thread title",
  "Thread body (optional)": "Thread body (optional)",
  "Create thread": "Create thread",
  "Failed to create thread": "Failed to create thread",
  "Open on AniList": "Open on AniList",
  "This thread is locked.": "This thread is locked.",
  "No threads for this title yet.": "No threads for this title yet.",
  "Be the first to start a discussion.": "Be the first to start a discussion.",
  "Load more threads": "Load more threads",
  "No comments yet": "No comments yet",
  "Loading more": "Loading more",
  "Failed to post comment": "Failed to post comment",
  "Show AniList comments": "Show AniList comments",
  "Show forum threads and comments from AniList on anime detail pages.":
    "Show forum threads and comments from AniList on anime detail pages.",
  "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.",

  "Blur comments by default": "Blur comments by default",
  "Comments on episode/show pages are blurred until you reveal them, even if they are not tagged as spoilers.":
    "Comments on episode/show pages are blurred until you reveal them, even if they are not tagged as spoilers.",
  "Blur episode images on detail page": "Blur episode images on detail page",
  "Blurs the hero image and stills on the episode detail page until you click reveal.":
    "Blurs the hero image and stills on the episode detail page until you click reveal.",

  Likes: "Likes",
  Newest: "Newest",
  Oldest: "Oldest",
  "Contains spoiler": "Contains spoiler",
  "Write a comment...": "Write a comment...",
  "Comments may take a moment to appear on Trakt": "Comments may take a moment to appear on Trakt",
  "Spoiler — Click to reveal": "Spoiler — Click to reveal",
  "Spoiler — Click": "Spoiler — Click",
  "sports.customize": "Customize",
  "sports.customize.title": "Customize Leagues",
  "sports.customize.selected": "{n} selected",
  "sports.customize.all": "All",
  "sports.customize.selectGroupAll": "Select all",
  "sports.customize.deselectGroupAll": "Deselect all",
  "sports.customize.selectAll": "Select all",
  "sports.customize.clearAll": "Clear all",
  "sports.customize.cancel": "Cancel",
  "sports.customize.save": "Save",
  Upcoming: "Upcoming",

  "Add Custom Source": "Add Custom Source",
  "Provide a JSON link or paste it directly.": "Provide a JSON link or paste it directly.",
  "JSON URL": "JSON URL",
  "Paste JSON": "Paste JSON",
  "URL cannot be empty": "URL cannot be empty",
  "Failed to fetch JSON": "Failed to fetch JSON",
  "JSON cannot be empty": "JSON cannot be empty",
  "Invalid SourceRow JSON format": "Invalid SourceRow JSON format",
  "Add Source": "Add Source",
  "Edit Folder Images": "Edit Folder Images",
  "Cover Image URL": "Cover Image URL",
  "Focus GIF URL": "Focus GIF URL",
  "Addon not installed": "Addon not installed",
  "This section depends on the addon": "This section depends on the addon",
  "You must install this addon in your Stremio account first so Harbor can fetch its works.":
    "You must install this addon in your Stremio account first so Harbor can fetch its works.",
  "Missing TMDB Key": "Missing TMDB Key",
  "This section relies on TMDB discovery features.":
    "This section relies on TMDB discovery features.",
  "Please add your TMDB API key in the Library & Metadata settings to view this folder.":
    "Please add your TMDB API key in the Library & Metadata settings to view this folder.",
  OK: "OK",
  "Loading...": "Loading...",

  "Top People": "Top People",
  "Ranking source": "Ranking source",
  "How Harbor Rank works": "How Harbor Rank works",
  "Harbor Rank": "Harbor Rank",
  Trending: "Trending",
  "Top on TMDB": "Top on TMDB",
  "Top on IMDb": "Top on IMDb",
  Consensus: "Consensus",
  Harbor: "Harbor",
  TMDB: "TMDB",
  IMDb: "IMDb",
  "Our all-time ranking of a body of work, fully explained.":
    "Our all-time ranking of a body of work, fully explained.",
  "Who is breaking out this week. Live, with weekly movement.":
    "Who is breaking out this week. Live, with weekly movement.",
  "Steady popularity across TMDB right now.": "Steady popularity across TMDB right now.",
  "Built from IMDb's public datasets. Career ratings volume.":
    "Built from IMDb's public datasets. Career ratings volume.",
  "A blend of the sources above by percentile. Degrades gracefully when one is missing.":
    "A blend of the sources above by percentile. Degrades gracefully when one is missing.",

  Actors: "Actors",
  Directors: "Directors",
  Producers: "Producers",
  Writers: "Writers",
  Actor: "Actor",
  Director: "Director",
  Producer: "Producer",
  Writer: "Writer",
  Department: "Department",
  Country: "Country",
  "All countries": "All countries",
  "Birthplace, not nationality": "Birthplace, not nationality",
  "Filter by name or title": "Filter by name or title",
  "{n} of {total}": "{n} of {total}",

  "Hall of Fame": "Hall of Fame",
  "Trending now": "Trending now",
  "Most popular": "Most popular",
  "Consensus #1": "Consensus #1",
  "View {name}": "View {name}",
  "How this is ranked": "How this is ranked",
  "Ranked #1 of {total} for {acclaimed} acclaimed titles and {awards} major awards.":
    "Ranked #1 of {total} for {acclaimed} acclaimed titles and {awards} major awards.",
  "Up {n} spots this week": "Up {n} spots this week",
  "New to the chart": "New to the chart",

  "Open {name}, ranked {rank}": "Open {name}, ranked {rank}",
  "Open {title}": "Open {title}",
  "Award winner": "Award winner",
  "{v} avg": "{v} avg",
  SCORE: "SCORE",
  "{avg} avg · {n} rated": "{avg} avg · {n} rated",
  "{wins} wins": "{wins} wins",
  "{noms} noms": "{noms} noms",
  "{wins} major award wins, {noms} nominations": "{wins} major award wins, {noms} nominations",
  "acclaimed titles": "acclaimed titles",
  "major awards": "major awards",
  "lead roles": "lead roles",
  "Awards data unavailable": "Awards data unavailable",
  "Not enough rated work yet": "Not enough rated work yet",
  "Blended from": "Blended from",

  NEW: "NEW",
  "New this week": "New this week",
  "Up {n} this week": "Up {n} this week",
  "Down {n} this week": "Down {n} this week",
  "No change this week": "No change this week",

  "Top 10": "Top 10",
  "11-25": "11-25",
  "26-50": "26-50",
  "51-100": "51-100",
  "101+": "101+",

  "Showing last synced ranking": "Showing last synced ranking",
  "No people match these filters": "No people match these filters",
  "Widen the department or country to see more.": "Widen the department or country to see more.",
  "Clear filters": "Clear filters",
  "Couldn't load rankings": "Couldn't load rankings",
  "Something went wrong reaching the ranking feed.":
    "Something went wrong reaching the ranking feed.",
  "Add a TMDB key to load rankings": "Add a TMDB key to load rankings",
  "Trending and Top on TMDB read live data, which needs your own TMDB key.":
    "Trending and Top on TMDB read live data, which needs your own TMDB key.",
  "Open settings": "Open settings",
  "All-time body of work, not who is trending. Trending and Top on TMDB are the live tabs.":
    "All-time body of work, not who is trending. Trending and Top on TMDB are the live tabs.",
  "update.ready": "Update ready to install",
  "update.installing": "Installing update",
  "update.downloading": "Downloading update",
  "update.failed": "Update failed",
  "update.available": "Update available",
  "update.harborVersion": "Harbor {version}",
  "update.downloadComplete": "Download complete",
  "update.fetching": "Fetching the latest version",
  "update.errorServer": "There was an error connecting to the update server.",
  "update.later": "Later",
  "update.download": "Download",
  "update.installRestart": "Install and restart",
  "update.restartAuto": "Harbor will restart automatically.",
  "update.tryAgain": "Try again",
  "update.keepUsing": "Keep using Harbor while it downloads",
  "update.of": "{downloaded} of {total}",
  "mpv.conf": "mpv.conf",
  ...settingsRefinements,
  ...nytTv,
  ...curatedLists,
  ...filmRegistry,
  ...adaptation,
  ...production,
  ...criticism,
  ...soundtrack,
  ...country,
  ...personCraft,
  ...gameHackDiscovery,
  ...gameStudioCatalog,
  ...gameDiscoveryPicker,
  ...gameLibraryManagement,
  ...gameAtlasDiscovery,
  ...gameRoms,
  ...gameDetailFlow,
  ...gameExploreRows,
  ...gameSourceDiscovery,
  ...gameDownloadCenter,
  ...gameDownloadNotifications,
  ...gameSourceAlerts,
  ...gameModUpdates,
  ...gameMinecraft,
  ...gameGuides,
  ...gameRecommendations,
  ...gameOverwatch,
  ...gameValorant,
  ...gameDota,
  ...gameLeague,
  ...gameWowEquipment,
  ...gameWowTalents,
  ...gameWowProgress,
  ...gameWowRuns,
  ...gameOwnedDiscovery,
  ...gameBackups,
  ...gameArchives,
  ...gameSetup,
  ...gameHydraImport,
  ...gameSteamShortcuts,
  ...gameGallery,
  ...gameAgeRatings,
  ...gameMetadataMatching,
  ...gameArtwork,
  ...gamePokemonUi,
  ...customArtwork,
  ...gameLibraryRefinements,
  ...gameRomLibrary,
  ...gameNotes,
  ...playOrders,
  ...jlMediaVision,
};

export default en;
import videoCast from "./en/video-cast";
