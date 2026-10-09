import type { SportsGame } from "./espn-types";

type VenuePhoto = { id: string; name: string; photo: string; sourceUrl: string };
/** Real venue photography is archived pending documented reuse permission. */
export function staticEventVenuePhoto(_game?: SportsGame): VenuePhoto | undefined {
  return undefined;
}
