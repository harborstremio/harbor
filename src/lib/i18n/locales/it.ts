import settingsRefinements from "./it/settings-refinements";
import catalog01 from "./it/catalog-01";
import catalog02 from "./it/catalog-02";
import catalog03 from "./it/catalog-03";
import catalog04 from "./it/catalog-04";
import catalog05 from "./it/catalog-05";
import catalog06 from "./it/catalog-06";
import catalog07 from "./it/catalog-07";
import catalog08 from "./it/catalog-08";
import catalog09 from "./it/catalog-09";
import catalog10 from "./it/catalog-10";
import catalog11 from "./it/catalog-11";
import catalog12 from "./it/catalog-12";
import coverage from "./it/coverage";

const it: Record<string, string> = {
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
  ...coverage,
  ...settingsRefinements,
};

export default it;
