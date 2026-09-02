import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { usePosterChain } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { Meta } from "@/lib/cinemeta";
import type { TopTitle } from "@/lib/harbor-rank";
import type { KnownForEntry } from "@/lib/rankings";
import { knownToMeta, titleToMeta } from "./people-utils";
import { KnownTileHover, useHoverDwell } from "./person-known-hover";

type StripSize = "hero" | "featured" | "dense";

type Tile = {
  key: string;
  metaId: string;
  title: string;
  posterPath: string | null;
  award: boolean;
  awardType: string | null;
  type: "movie" | "series";
  meta: Meta;
};

const TILE_CLASS: Record<StripSize, string> = {
  hero: "h-[108px] w-[72px] rounded-md",
  featured: "h-[84px] w-[56px] rounded-md",
  dense: "h-[66px] w-[44px] rounded-md",
};

const RAW_SIZE: Record<StripSize, "w154" | "w92"> = {
  hero: "w154",
  featured: "w154",
  dense: "w92",
};

const BADGE: Record<StripSize, { box: string; logo: number }> = {
  hero: { box: "h-[18px] min-w-[18px] px-[3px]", logo: 12 },
  featured: { box: "h-4 min-w-4 px-0.5", logo: 10 },
  dense: { box: "h-3.5 min-w-3.5 px-px", logo: 8 },
};

const AWARD_LABEL: Record<string, string> = {
  oscar: "Academy Award",
  emmy: "Primetime Emmy",
  golden_globe: "Golden Globe",
  bafta: "BAFTA Award",
  bafta_tv: "BAFTA TV Award",
  sag: "SAG Award",
  critics_choice: "Critics' Choice Award",
  cannes: "Cannes",
  venice: "Venice Film Festival",
  berlin: "Berlinale",
  annie: "Annie Award",
  spirit: "Independent Spirit Award",
  saturn: "Saturn Award",
  cesar: "Cesar Award",
  goya: "Goya Award",
  blue_dragon: "Blue Dragon Award",
  baeksang: "Baeksang Arts Award",
  bifa: "British Independent Film Award",
};

function awardLabel(t: ReturnType<typeof useT>, type: string): string {
  const name = AWARD_LABEL[type];
  return name ? t("{award} winner", { award: name }) : t("Award winner");
}

function fromTitle(tt: TopTitle): Tile {
  const meta = titleToMeta(tt);
  return {
    key: tt.metaId,
    metaId: tt.metaId,
    title: tt.title,
    posterPath: tt.posterPath,
    award: tt.awardWinner,
    awardType: tt.awardType ?? null,
    type: meta.type === "series" ? "series" : "movie",
    meta,
  };
}

function fromKnown(k: KnownForEntry): Tile {
  return {
    key: `${k.mediaType}:${k.id}`,
    metaId: `tmdb:${k.mediaType}:${k.id}`,
    title: k.title,
    posterPath: k.posterPath,
    award: false,
    awardType: null,
    type: k.mediaType === "tv" ? "series" : "movie",
    meta: knownToMeta(k),
  };
}

export function PersonKnownStrip({
  titles,
  known,
  size,
  count,
  onOpenMeta,
}: {
  titles?: TopTitle[];
  known?: KnownForEntry[];
  size: StripSize;
  count: number;
  onOpenMeta: (meta: Meta) => void;
}) {
  const tiles = titles
    ? titles.slice(0, count).map(fromTitle)
    : (known ?? []).slice(0, count).map(fromKnown);
  if (tiles.length === 0) return null;
  return (
    <div className="harbor-scroll -mx-1.5 flex gap-2 overflow-x-auto overflow-y-hidden px-1.5 py-1.5">
      {tiles.map((tile) => (
        <KnownTile key={tile.key} tile={tile} size={size} onOpen={() => onOpenMeta(tile.meta)} />
      ))}
    </div>
  );
}

function KnownTile({ tile, size, onOpen }: { tile: Tile; size: StripSize; onOpen: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const dwell = useHoverDwell();
  const raw = tile.posterPath
    ? `https://image.tmdb.org/t/p/${RAW_SIZE[size]}${tile.posterPath}`
    : undefined;
  const poster = usePosterChain(settings.rpdbKey, tile.metaId, raw, tile.type);
  const tint = tile.awardType ? laurelColorFor(tile.awardType) : null;
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={(e) => dwell.onEnter(e.currentTarget)}
        onMouseLeave={dwell.onLeave}
        onFocus={(e) => dwell.openNow(e.currentTarget)}
        onBlur={dwell.onLeave}
        aria-label={t("Open {title}", { title: tile.title })}
        className={`group/tile relative shrink-0 overflow-hidden bg-canvas ring-1 ring-edge-soft transition-[box-shadow,filter] duration-150 ease-out hover:ring-2 hover:ring-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${TILE_CLASS[size]}`}
      >
        {poster.src ? (
          <img
            src={poster.src}
            alt=""
            loading="lazy"
            onError={poster.onError}
            className="h-full w-full object-cover transition-[filter] duration-150 ease-out group-hover/tile:brightness-110 motion-reduce:transition-none"
          />
        ) : (
          <span className="block h-full w-full bg-gradient-to-br from-canvas to-elevated" />
        )}
        {tile.award && tile.awardType && (
          <span
            className="absolute start-0.5 top-0.5 flex items-center justify-center"
            style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.9))${tint ? ` drop-shadow(0 0 2px ${tint})` : ""}` }}
            title={awardLabel(t, tile.awardType)}
          >
            <AwardLogo type={tile.awardType} size={BADGE[size].logo + 3} />
          </span>
        )}
      </button>
      {dwell.open && dwell.rect && <KnownTileHover meta={tile.meta} rect={dwell.rect} />}
    </>
  );
}
