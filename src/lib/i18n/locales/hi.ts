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

const hi: Record<string, string> = {
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
};

export default hi;
