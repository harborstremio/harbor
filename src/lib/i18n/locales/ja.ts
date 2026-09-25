import listenTogether from "./ja/listen-together";
import music from "./ja/music";
import sportsConsent from "./ja/sports-consent";
import sportsStatistics from "./ja/sports-statistics";
import sportsApi from "./ja/sports-api";
import esportsArena from "./ja/esports-arena";
import sportsHub from "./ja/sports-hub";
import contextActionsFallback from "./context-actions-fallback";

import ebookSources from "./ja/ebook-sources";
import settingsRefinements from "./ja/settings-refinements";
import addons from "./ja/addons";
import appFill from "./ja/app-fill";
import awards from "./ja/awards";
import bpSources from "./ja/bp-sources";
import catalog from "./ja/catalog";
import chrome from "./ja/chrome";
import common from "./ja/common";
import controllers from "./ja/controllers";
import coverage from "./ja/coverage";
import detail from "./ja/detail";
import discover from "./ja/discover";
import downloads from "./ja/downloads";
import extra from "./ja/extra";
import gap from "./ja/gap";
import library from "./ja/library";
import lists from "./ja/lists";
import live from "./ja/live";
import manga from "./ja/manga";
import masthead from "./ja/masthead";
import misc from "./ja/misc";
import player from "./ja/player";
import plurals from "./ja/plurals";
import profileFill from "./ja/profile-fill";
import rails from "./ja/rails";
import settingsFill from "./ja/settings-fill";
import settings from "./ja/settings";
import spotlights from "./ja/spotlights";
import sweep from "./ja/sweep";
import sync from "./ja/sync";
import together from "./ja/together";
import used from "./ja/used";
import questions from "./ja/questions";
import wired from "./ja/wired";
import plugins from "./ja/plugins";
import brands from "./ja/brands";
import bpSports from "./ja/bp-sports";

const ja: Record<string, string> = {
  ...videoCast,
  ...music,
  ...contextActionsFallback,

  ...ebookSources,
  ...coverage,
  ...sweep,
  ...wired,
  ...gap,
  ...appFill,
  ...profileFill,
  ...settingsFill,
  ...used,
  ...extra,
  ...addons,
  ...awards,
  ...bpSources,
  ...catalog,
  ...chrome,
  ...common,
  ...controllers,
  ...detail,
  ...discover,
  ...downloads,
  ...library,
  ...lists,
  ...live,
  ...manga,
  ...masthead,
  ...misc,
  ...player,
  ...plurals,
  ...rails,
  ...settings,
  ...spotlights,
  ...sync,
  ...together,
  ...questions,
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
};

export default ja;
import videoCast from "./ja/video-cast";
