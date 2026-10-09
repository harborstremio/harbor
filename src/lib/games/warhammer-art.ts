// Original Games Workshop marks from the publisher's setting/armies pages.
// Keep their original colors and transparent backgrounds; no generated assets.
import type { WarhammerFaction } from "./warhammer-data";
const root = "https://warhammer40000.com/wp-content/uploads/2023/07/";
export const WARHAMMER_LOGO = `${root}rGcBJTxHogKhgvd1-350x77.png`;
// Dedicated publisher key art: a game/news image can be a roadmap or a small capsule.
// https://www.focus-entmt.com/en/games/warhammer-40000-space-marine-2
export const WARHAMMER_WORLD_ART = "https://cdn.focus-home.com/fhi-fastforward-admin/resources/games/warhammer-40000-space-marine-2/images/08122022_97eeb194612248db9373a8d549b9bc0d.jpeg";
export const WARHAMMER_FACTION_ART: Record<WarhammerFaction, string> = {
  marines: `${root}sPTkCEkJZwCBxpWw.png`,
  mechanicus: `${root}YB8TIAZIEl2smA3v.png`,
  necrons: `${root}r6TrutAmdCzZ5Kpz.png`,
  orks: `${root}xDq2ZdumwnV3B60k.png`,
  tyranids: `${root}02kwomwcxx6IxqW9.png`,
  chaos: `${root}lMlYeCVkxxBNkEuY.png`,
};
