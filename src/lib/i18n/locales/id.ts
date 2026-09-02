import coverage from "./id/coverage";
import catalog01 from "./id/catalog-01";
import catalog02 from "./id/catalog-02";
import catalog03 from "./id/catalog-03";
import catalog04 from "./id/catalog-04";
import catalog05 from "./id/catalog-05";
import catalog06 from "./id/catalog-06";
import catalog07 from "./id/catalog-07";
import catalog08 from "./id/catalog-08";
import catalog09 from "./id/catalog-09";
import catalog10 from "./id/catalog-10";
import catalog11 from "./id/catalog-11";
import catalog12 from "./id/catalog-12";
import catalog13 from "./id/catalog-13";
import audit from "./id/audit";
import identityAudit from "./id/identity-audit";

const id: Record<string, string> = {
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
  ...audit,
  ...identityAudit,
};

export default id;
