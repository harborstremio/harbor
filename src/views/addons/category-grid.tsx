import streamsIcon from "@/assets/category/streams.svg";
import catalogsIcon from "@/assets/category/catalogs.svg";
import subtitlesIcon from "@/assets/category/subtitles.svg";
import animeIcon from "@/assets/category/anime.svg";
import sportsIcon from "@/assets/category/sports.svg";
import livetvIcon from "@/assets/category/livetv.svg";
import { useT } from "@/lib/i18n";

const CATEGORY_TILES: Array<{
  cat: string;
  title: string;
  blurb: string;
  accent: string;
  icon: string;
}> = [
  {
    cat: "http+streams",
    title: "Streaming",
    blurb: "Where your video comes from",
    accent: "from-amber-500/40 to-orange-600/30",
    icon: streamsIcon,
  },
  {
    cat: "metadata",
    title: "Catalogs",
    blurb: "Posters, ratings, lists",
    accent: "from-blue-500/40 to-indigo-600/30",
    icon: catalogsIcon,
  },
  {
    cat: "subtitles",
    title: "Subtitles",
    blurb: "Captions in your language",
    accent: "from-violet-500/40 to-fuchsia-600/30",
    icon: subtitlesIcon,
  },
  {
    cat: "anime",
    title: "Anime",
    blurb: "Kitsu, MAL, season-aware",
    accent: "from-rose-500/40 to-pink-600/30",
    icon: animeIcon,
  },
  {
    cat: "torrents",
    title: "Torrents",
    blurb: "P2P sources, debrid-ready",
    accent: "from-emerald-500/40 to-teal-600/30",
    icon: sportsIcon,
  },
  {
    cat: "live+tv",
    title: "Live TV",
    blurb: "OTA channels + IPTV",
    accent: "from-cyan-500/40 to-sky-600/30",
    icon: livetvIcon,
  },
];

export function CategoryGrid({ onCategorySelect }: { onCategorySelect: (cat: string) => void }) {
  const t = useT();
  return (
    <section>
      <header className="mb-5 flex items-end justify-between gap-4 border-b border-edge-soft/70 pb-3">
        <div>
          <h3 className="font-display text-[26px] font-medium tracking-tight text-ink">
            {t("Browse by category")}
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
            {t("Six places to start. Tap one and we'll filter the catalog for you.")}
          </p>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {CATEGORY_TILES.map((tile) => (
          <div
            key={tile.cat}
            role="button"
            tabIndex={0}
            onClick={() => onCategorySelect(tile.cat)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onCategorySelect(tile.cat)}
            className="group relative flex h-[120px] cursor-pointer overflow-hidden rounded-2xl border border-edge-soft transition-all hover:border-edge"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${tile.accent}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas/85 via-canvas/30 to-transparent" />
            <img
              src={tile.icon}
              alt=""
              aria-hidden
              draggable={false}
              className={`pointer-events-none absolute end-4 top-4 select-none opacity-55 ${
                tile.cat === "streams" ? "h-16 w-16" : "h-14 w-14"
              }`}
            />
            <div className="relative flex flex-1 flex-col justify-end p-5">
              <h4 className="font-display text-[20px] font-medium tracking-tight text-ink">
                {t(tile.title)}
              </h4>
              <p className="text-[12px] text-ink-muted">{t(tile.blurb)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
