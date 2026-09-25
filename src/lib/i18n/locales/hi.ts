import listenTogether from "./hi/listen-together";
import music from "./hi/music";
import sportsConsent from "./hi/sports-consent";
import sportsStatistics from "./hi/sports-statistics";
import sportsApi from "./hi/sports-api";
import esportsArena from "./hi/esports-arena";
import sportsHub from "./hi/sports-hub";
import contextActionsFallback from "./context-actions-fallback";

import ebookSources from "./hi/ebook-sources";
import settingsRefinements from "./hi/settings-refinements";
import catalogSymbols from "./hi/catalog-symbols";
import catalogAC from "./hi/catalog-a-c";
import catalogDF from "./hi/catalog-d-f";
import catalogGI from "./hi/catalog-g-i";
import catalogJL from "./hi/catalog-j-l";
import catalogMO from "./hi/catalog-m-o";
import catalogPR from "./hi/catalog-p-r";
import catalogSU from "./hi/catalog-s-u";
import catalogVZ from "./hi/catalog-v-z";
import coverage from "./hi/coverage";
import plugins from "./hi/plugins";
import brands from "./hi/brands";
import bpSports from "./hi/bp-sports";

const hi: Record<string, string> = {
  ...videoCast,
  ...music,
  ...contextActionsFallback,

  ...ebookSources,
  ...catalogSymbols,
  ...catalogAC,
  ...catalogDF,
  ...catalogGI,
  ...catalogJL,
  ...catalogMO,
  ...catalogPR,
  ...catalogSU,
  ...catalogVZ,
  ...coverage,
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

export default hi;
import videoCast from "./hi/video-cast";
