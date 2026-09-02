import type { CSSProperties } from "react";
import { NavGlyph } from "./nav-glyph";

// Drop-in for lucide's Search across every search bar. Same call shape
// (<Search size={N} className={...} />) so a call site needs no change beyond
// its import: it renders the filled magnifying glass from nav-glyph, tinted by
// currentColor. strokeWidth is accepted for API parity and ignored, since a
// filled glyph has no stroke to weight.
export function Search({
  size = 20,
  className,
  style,
}: {
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <NavGlyph name="search" className={className} style={{ ...style, width: size, height: size }} />
  );
}
