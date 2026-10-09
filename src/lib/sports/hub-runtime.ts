// Runtime boundary for data-only helpers: importing a parser or artwork cache
// in isolation must not initialize the native/network request layer.
export { HUB_LEAGUES, sportsJson } from "./hub-data";
