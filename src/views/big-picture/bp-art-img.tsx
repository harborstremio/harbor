import type { ReactEventHandler } from "react";
import { bpArtSrc } from "./bp-ring-motion";

export type BpArtProps = {
  src: string | undefined;
  onLoad?: ReactEventHandler<HTMLImageElement>;
  onError?: ReactEventHandler<HTMLImageElement>;
  className?: string;
};

// `absolute inset-0 h-full w-full` is the contract, not styling, and it is
// prefixed so a caller cannot drop it. Releasing swaps the src to a 1x1 gif, so
// an img that SIZES its own cell collapses to 1px, and measureFocusables
// (bp-focus-core.ts:116-126) drops width<2, which makes that card a navigation
// DEAD END rather than a skip. Only art drawn inside an absolutely positioned
// box may come through here: clear logos, wordmarks and every other
// intrinsically sized img in normal flow must keep a plain <img src>.
// The box also has to BE the containing block. Converting an h-full w-full img
// inside an unpositioned span sends the art to whatever ancestor is positioned,
// which on the awards grid was the page.
export function BpArt({ src, onLoad, onError, className }: BpArtProps) {
  if (!src) return null;
  return (
    <img
      ref={(el) => bpArtSrc(el, src)}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={onLoad}
      onError={onError}
      className={`absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  );
}
