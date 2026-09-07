import settingsRefinements from "./pt/settings-refinements";
import experimentalUpdates from "./pt/experimental-updates";
import coverage from "./pt/coverage";
import chrome from "./pt/chrome";
import common from "./pt/common";
import catalog from "./pt/catalog";
import detail from "./pt/detail";
import player from "./pt/player";
import live from "./pt/live";
import settings from "./pt/settings";
import settingsFill from "./pt/settings-fill";
import profileFill from "./pt/profile-fill";
import appFill from "./pt/app-fill";
import library from "./pt/library";
import sync from "./pt/sync";
import lists from "./pt/lists";
import downloads from "./pt/downloads";
import together from "./pt/together";
import rails from "./pt/rails";
import masthead from "./pt/masthead";
import discover from "./pt/discover";
import spotlights from "./pt/spotlights";
import misc from "./pt/misc";
import awards from "./pt/awards";
import addons from "./pt/addons";
import extra from "./pt/extra";
import manga from "./pt/manga";
import controllers from "./pt/controllers";

import bpSources from "./pt/bp-sources";
import used from "./pt/used";
import sweep from "./pt/sweep";
import sourceCoverage from "./pt/source-coverage";
import wired from "./pt/wired";
import wiringSweep from "./pt/wiring-sweep";
import wiringSweep2 from "./pt/wiring-sweep-2";
import wiringSweep3 from "./pt/wiring-sweep-3";
import wiringSweep4 from "./pt/wiring-sweep-4";

const pt: Record<string, string> = {
  ...coverage,
  ...chrome,
  ...common,
  ...catalog,
  ...detail,
  ...player,
  ...live,
  ...settings,
  ...settingsFill,
  ...profileFill,
  ...appFill,
  ...library,
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
  ...extra,
  ...manga,
  ...controllers,
  ...bpSources,
  ...used,
  ...sweep,
  ...sourceCoverage,
  ...wired,
  ...wiringSweep,
  ...wiringSweep2,
  ...wiringSweep3,
  ...wiringSweep4,
  ...experimentalUpdates,
  ...settingsRefinements,
};

export default pt;
