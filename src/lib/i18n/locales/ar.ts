import listenTogether from "./ar/listen-together";
import music from "./ar/music";
import sportsConsent from "./ar/sports-consent";
import sportsStatistics from "./ar/sports-statistics";
import sportsApi from "./ar/sports-api";
import esportsArena from "./ar/esports-arena";
import sportsHub from "./ar/sports-hub";
import bpSports from "./ar/bp-sports";
import contextActionsFallback from "./context-actions-fallback";

import ebookSources from "./ar/ebook-sources";
import settingsRefinements from "./ar/settings-refinements";
import uiFallback from "./ui-fallback";
import experimentalUpdates from "./ar/experimental-updates";
import coverage from "./ar/coverage";
import settingsFill from "./ar/settings-fill";
import profileFill from "./ar/profile-fill";
import appFill from "./ar/app-fill";
import used from "./ar/used";
import sweep from "./ar/sweep";
import wired from "./ar/wired";

import chrome from "./ar/chrome";
import common from "./ar/common";
import catalog from "./ar/catalog";
import detail from "./ar/detail";
import player from "./ar/player";
import live from "./ar/live";
import settings from "./ar/settings";
import library from "./ar/library";
import manga from "./ar/manga";
import sync from "./ar/sync";
import lists from "./ar/lists";
import downloads from "./ar/downloads";
import together from "./ar/together";
import rails from "./ar/rails";
import masthead from "./ar/masthead";
import discover from "./ar/discover";
import spotlights from "./ar/spotlights";
import misc from "./ar/misc";
import awards from "./ar/awards";
import addons from "./ar/addons";
import controllers from "./ar/controllers";
import bpSources from "./ar/bp-sources";
import ageGate from "./ar/age-gate";
import dynamic from "./ar/dynamic";
import plurals from "./ar/plurals";
import audit from "./ar/audit";
import plugins from "./ar/plugins";
import brands from "./ar/brands";
import contextActions from "./ar/context-actions";

const ar: Record<string, string> = {
  ...videoCast,
  ...music,
  ...contextActionsFallback,

  ...ebookSources,
  ...uiFallback,
  ...coverage,
  ...settingsFill,
  ...profileFill,
  ...appFill,
  ...used,
  ...sweep,
  ...wired,

  ...chrome,
  ...common,
  ...catalog,
  ...detail,
  ...player,
  ...live,
  ...settings,
  ...library,
  ...manga,
  ...sync,
  ...lists,
  ...downloads,
  ...together,
  ...rails,
  ...masthead,
  ...discover,
  ...spotlights,
  ...misc,
  ...awards,
  ...addons,
  ...controllers,
  ...bpSources,
  ...ageGate,
  ...dynamic,
  ...plurals,
  ...audit,
  ...experimentalUpdates,
  ...settingsRefinements,
  ...plugins,
  ...brands,
  ...sportsHub,
  ...sportsConsent,
  ...sportsStatistics,
  ...sportsApi,
  ...esportsArena,
  ...bpSports,
  ...listenTogether,
  ...contextActions,
};

export default ar;
import videoCast from "./ar/video-cast";
