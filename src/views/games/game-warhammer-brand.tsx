import { GameArt } from "./game-art";

export type WarhammerBrand = "tv" | "community" | "focus" | "lexicanum" | "black-library" | "40k" | "sigmar" | "heresy" | "oldworld";

/** Original marks bundled from the publishers; provenance lives beside the assets. */
export function WarhammerBrandMark({ brand }: { brand: WarhammerBrand }) {
  const extension = brand === "focus" ? "svg" : brand === "lexicanum" ? "ico" : "png";
  return <GameArt src={`/games/warhammer/${brand}.${extension}`} className={`wh-brand is-${brand}`}/>;
}
