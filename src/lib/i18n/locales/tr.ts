import listenTogether from "./tr/listen-together";
import music from "./tr/music";
import sportsConsent from "./tr/sports-consent";
import sportsStatistics from "./tr/sports-statistics";
import sportsApi from "./tr/sports-api";
import esportsArena from "./tr/esports-arena";
import sportsHub from "./tr/sports-hub";
import contextActionsFallback from "./context-actions-fallback";

import ebookSources from "./tr/ebook-sources";
import settingsRefinements from "./tr/settings-refinements";
import miscA from "./tr/misc-a";
import miscB from "./tr/misc-b";
import miscC from "./tr/misc-c";
import common from "./tr/common";
import playback from "./tr/playback";
import settings from "./tr/settings";
import personalization from "./tr/personalization";
import library from "./tr/library";
import social from "./tr/social";
import discovery from "./tr/discovery";
import addons from "./tr/addons";
import recent from "./tr/recent";
import residual from "./tr/residual";
import finalResidual from "./tr/final";
import coverage from "./tr/coverage";
import plugins from "./tr/plugins";
import brands from "./tr/brands";
import bpSports from "./tr/bp-sports";

const tr: Record<string, string> = {
  ...videoCast,
  ...music,
  ...contextActionsFallback,

  ...ebookSources,
  ...miscA,
  ...miscB,
  ...miscC,
  ...common,
  ...playback,
  ...settings,
  ...personalization,
  ...library,
  ...social,
  ...discovery,
  ...addons,
  ...recent,
  ...residual,
  ...finalResidual,
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

export default tr;
import videoCast from "./tr/video-cast";
