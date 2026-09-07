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

const zh: Record<string, string> = {
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
};

export default zh;
