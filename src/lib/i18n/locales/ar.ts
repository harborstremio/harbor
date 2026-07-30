import addons from "./ar/addons";
import awards from "./ar/awards";
import catalog from "./ar/catalog";
import chrome from "./ar/chrome";
import common from "./ar/common";
import detail from "./ar/detail";
import discover from "./ar/discover";
import downloads from "./ar/downloads";
import library from "./ar/library";
import lists from "./ar/lists";
import live from "./ar/live";
import manga from "./ar/manga";
import masthead from "./ar/masthead";
import misc from "./ar/misc";
import player from "./ar/player";
import rails from "./ar/rails";
import settings from "./ar/settings";
import settingsFill from "./ar/settings-fill";
import profileFill from "./ar/profile-fill";
import appFill from "./ar/app-fill";
import spotlights from "./ar/spotlights";
import sync from "./ar/sync";
import together from "./ar/together";
import controllers from "./ar/controllers";

import used from "./ar/used";

const ar: Record<string, string> = {
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
  ...used,
};

export default ar;
