import { CompanionRequests } from "./companion-request";
import { wowAddonJson } from "./wow-addon-provider";
import { parseWowAddonCategories, parseWowAddonList } from "./wow-addon-catalog-data";

const BASE = "https://api.mmoui.com/v4/game/WOW/";
const requests = new CompanionRequests((url, signal) => wowAddonJson(url, signal, 8 * 1024 * 1024));
// Categories and catalog are independent observations so a category outage need
// not hide healthy search results. Fetch only when the browse flow is opened.
export const loadWowAddonCatalog = (signal: AbortSignal) => requests.get(`${BASE}filelist.json`, 30 * 60_000, parseWowAddonList, signal);
export const loadWowAddonCategories = (signal: AbortSignal) => requests.get(`${BASE}categorylist.json`, 6 * 3600_000, parseWowAddonCategories, signal);
