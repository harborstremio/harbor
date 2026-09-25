import listenTogether from "./zh/listen-together";
import music from "./zh/music";
import sportsConsent from "./zh/sports-consent";
import sportsStatistics from "./zh/sports-statistics";
import sportsApi from "./zh/sports-api";
import esportsArena from "./zh/esports-arena";
import sportsHub from "./zh/sports-hub";
import contextActionsFallback from "./context-actions-fallback";

import ebookSources from "./zh/ebook-sources";
import settingsRefinements from "./zh/settings-refinements";
import coverage from "./zh/coverage";
import sweepA from "./zh/sweep-a";
import sweepB from "./zh/sweep-b";
import sweepC from "./zh/sweep-c";
import sweepD from "./zh/sweep-d";
import sweepE from "./zh/sweep-e";
import sweepF from "./zh/sweep-f";
import residual from "./zh/residual";
import core from "./zh/core";
import playback from "./zh/playback";
import discovery from "./zh/discovery";
import library from "./zh/library";
import settings from "./zh/settings";
import social from "./zh/social";
import live from "./zh/live";
import books from "./zh/books";
import system from "./zh/system";
import plugins from "./zh/plugins";
import brands from "./zh/brands";
import bpSports from "./zh/bp-sports";

const zh: Record<string, string> = {
  ...videoCast,
  ...music,
  ...contextActionsFallback,

  ...ebookSources,
  ...coverage,
  ...sweepA,
  ...sweepB,
  ...sweepC,
  ...sweepD,
  ...sweepE,
  ...sweepF,
  ...residual,
  ...core,
  ...playback,
  ...discovery,
  ...library,
  ...settings,
  ...social,
  ...live,
  ...books,
  ...system,
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

export default zh;
import videoCast from "./zh/video-cast";
