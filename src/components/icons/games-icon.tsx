import { NavGlyph } from "./nav-glyph";

export function GamesIcon({ size = 26 }: { size?: number }) {
  return <NavGlyph name="games" className="p-[2px]" style={{ width: size, height: size }} />;
}
