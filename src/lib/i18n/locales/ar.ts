import addons from "./ar/addons";
import awards from "./ar/awards";
import catalog from "./ar/catalog";
import chrome from "./ar/chrome";
import common from "./ar/common";
import detail from "./ar/detail";
import discover from "./ar/discover";
import downloads from "./ar/downloads";
import gap from "./ar/gap";
import library from "./ar/library";
import lists from "./ar/lists";
import live from "./ar/live";
import masthead from "./ar/masthead";
import misc from "./ar/misc";
import player from "./ar/player";
import rails from "./ar/rails";
import settings from "./ar/settings";
import spotlights from "./ar/spotlights";
import sync from "./ar/sync";
import together from "./ar/together";

const ar: Record<string, string> = {
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
  ...gap,
};

export default ar;
