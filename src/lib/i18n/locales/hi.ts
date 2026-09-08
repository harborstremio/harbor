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

const hi: Record<string, string> = {
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
};

export default hi;
