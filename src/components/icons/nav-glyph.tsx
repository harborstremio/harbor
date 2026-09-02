import type { CSSProperties } from "react";
import addons from "@/assets/nav-icons/addons.svg?raw";
import anime from "@/assets/nav-icons/anime.svg?raw";
import calendar from "@/assets/nav-icons/calendar.svg?raw";
import catalogs from "@/assets/nav-icons/catalogs.svg?raw";
import collections from "@/assets/nav-icons/collections.svg?raw";
import download from "@/assets/nav-icons/download.svg?raw";
import ebook from "@/assets/nav-icons/ebook.svg?raw";
import explore from "@/assets/nav-icons/explore.svg?raw";
import guide from "@/assets/nav-icons/guide.svg?raw";
import home from "@/assets/nav-icons/home.svg?raw";
import library from "@/assets/nav-icons/library.svg?raw";
import livetv from "@/assets/nav-icons/livetv.svg?raw";
import manga from "@/assets/nav-icons/manga.svg?raw";
import movies from "@/assets/nav-icons/movies.svg?raw";
import playlist from "@/assets/nav-icons/playlist.svg?raw";
import search from "@/assets/nav-icons/search.svg?raw";
import settings from "@/assets/nav-icons/settings.svg?raw";
import tv from "@/assets/nav-icons/tv.svg?raw";

// Same treatment as the player UI icons in ui-icon.tsx: these ship as solid #fff
// glyphs at 512 on a transparent canvas, so strip the prolog and swap the
// hardcoded white for currentColor to tint like the icons they replace (accent,
// muted, hover). The id="a" every export carries is stripped too, so twelve of
// them inlined on one page do not collide. Size comes from the wrapper span; the
// svg's own 512 width/height are overridden by [&>svg]:h-full/w-full.
function prep(raw: string): string {
  return raw
    .replace(/<\?xml[^>]*\?>/i, "")
    .replace(/<!DOCTYPE[^>]*>/i, "")
    .replace(/\sid="[^"]*"/i, "")
    .replace(/(fill|stroke)="#[0-9a-fA-F]{3,6}"/g, '$1="currentColor"');
}

const GLYPHS = {
  addons: prep(addons),
  anime: prep(anime),
  calendar: prep(calendar),
  catalogs: prep(catalogs),
  collections: prep(collections),
  download: prep(download),
  ebook: prep(ebook),
  explore: prep(explore),
  guide: prep(guide),
  home: prep(home),
  library: prep(library),
  livetv: prep(livetv),
  manga: prep(manga),
  movies: prep(movies),
  playlist: prep(playlist),
  search: prep(search),
  settings: prep(settings),
  tv: prep(tv),
} as const;

export type NavGlyphName = keyof typeof GLYPHS;

export function NavGlyph({
  name,
  className,
  style,
}: {
  name: NavGlyphName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={`inline-flex shrink-0 select-none items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>svg]:overflow-visible ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: GLYPHS[name] }}
    />
  );
}
