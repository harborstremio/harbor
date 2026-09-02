import { memo, type ReactElement } from "react";
import type { Meta } from "@/lib/cinemeta";
import { BpCardMarks } from "./bp-card-marks";

export { bpAnimeAward, bpAwardShortLabel } from "./bp-card-marks";

// The anime rows hand this to BpRow as cornerOf, and BpTile now draws the same
// column itself as `corner ?? <BpCardMarks/>`. Keeping the override and the
// default as one component is what lets the anime rows pick up the dub and
// award marks without bp-anime.tsx or bp-anime-row.tsx being touched, and means
// dropping cornerOf from them later loses nothing.
function BpAnimeCardBadgesBody({ meta }: { meta: Meta }) {
  return <BpCardMarks meta={meta} />;
}

// cornerOf returns a ReactNode, so bp-row mints a fresh element for every card
// on every render and BpTile's own memo can never bail on the anime page. Memo
// here bounds that to one cheap element creation instead of a whole subtree.
export const BpAnimeCardBadges = memo(BpAnimeCardBadgesBody);

const CORNERS = new WeakMap<Meta, ReactElement>();

export function animeCardBadges(meta: Meta) {
  const hit = CORNERS.get(meta);
  if (hit) return hit;
  const el = <BpAnimeCardBadges meta={meta} />;
  CORNERS.set(meta, el);
  return el;
}
