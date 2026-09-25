import listenTogether from "./ko/listen-together";
import music from "./ko/music";
import sportsConsent from "./ko/sports-consent";
import sportsStatistics from "./ko/sports-statistics";
import sportsApi from "./ko/sports-api";
import esportsArena from "./ko/esports-arena";
import sportsHub from "./ko/sports-hub";
import contextActionsFallback from "./context-actions-fallback";

import ebookSources from "./ko/ebook-sources";
import settingsRefinements from "./ko/settings-refinements";
import coverage from "./ko/coverage";
import catalog01 from "./ko/catalog-01";
import catalog02 from "./ko/catalog-02";
import catalog03 from "./ko/catalog-03";
import catalog04 from "./ko/catalog-04";
import catalog05 from "./ko/catalog-05";
import catalog06 from "./ko/catalog-06";
import catalog07 from "./ko/catalog-07";
import catalog08 from "./ko/catalog-08";
import catalog09 from "./ko/catalog-09";
import catalog10 from "./ko/catalog-10";
import catalog11 from "./ko/catalog-11";
import catalog12 from "./ko/catalog-12";
import catalog13 from "./ko/catalog-13";
import currentTail from "./ko/current-tail";
import plugins from "./ko/plugins";
import brands from "./ko/brands";
import bpSports from "./ko/bp-sports";

const ko: Record<string, string> = {
  ...videoCast,
  ...music,
  ...contextActionsFallback,

  ...ebookSources,
  ...coverage,
  ...catalog01,
  ...catalog02,
  ...catalog03,
  ...catalog04,
  ...catalog05,
  ...catalog06,
  ...catalog07,
  ...catalog08,
  ...catalog09,
  ...catalog10,
  ...catalog11,
  ...catalog12,
  ...catalog13,
  ...currentTail,
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

export default ko;
import videoCast from "./ko/video-cast";
