import type { SportsGame } from "@/lib/sports/espn-types";
import { staticEventVenuePhoto } from "@/lib/sports/event-venue-photo";

/** Curated venue assets resolve synchronously, without flashing a generic lookup result. */
export function useEventVenuePhoto(game?: SportsGame, _enabled = true) {
  return staticEventVenuePhoto(game);
}
