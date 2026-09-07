import settingsRefinements from "./vi/settings-refinements";
import coverage from "./vi/coverage";
import gap from "./vi/gap";
import plurals from "./vi/plurals";
import settingsFill from "./vi/settings-fill";
import profileFill from "./vi/profile-fill";
import appFill from "./vi/app-fill";
import used from "./vi/used";
import sweep from "./vi/sweep";
import sourceWiring from "./vi/source-wiring";
import residual from "./vi/residual";
import residualFinal from "./vi/residual-final";
import chrome from "./vi/chrome";
import common from "./vi/common";
import catalog from "./vi/catalog";
import detail from "./vi/detail";
import player from "./vi/player";
import live from "./vi/live";
import settings from "./vi/settings";
import library from "./vi/library";
import sync from "./vi/sync";
import lists from "./vi/lists";
import downloads from "./vi/downloads";
import together from "./vi/together";
import rails from "./vi/rails";
import masthead from "./vi/masthead";
import discover from "./vi/discover";
import spotlights from "./vi/spotlights";
import misc from "./vi/misc";
import awards from "./vi/awards";
import addons from "./vi/addons";
import extra from "./vi/extra";
import manga from "./vi/manga";
import controllers from "./vi/controllers";
import bpSources from "./vi/bp-sources";
import ageGate from "./vi/age-gate";

const vi: Record<string, string> = {
  ...coverage,
  ...gap,
  ...plurals,
  ...settingsFill,
  ...profileFill,
  ...appFill,
  ...used,
  ...sweep,
  ...sourceWiring,
  ...residual,
  ...residualFinal,
  ...chrome,
  ...common,
  ...catalog,
  ...detail,
  ...player,
  ...live,
  ...settings,
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
  ...ageGate,
  ...settingsRefinements,
};

export default vi;
