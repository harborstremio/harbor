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

const tr: Record<string, string> = {
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
};

export default tr;
