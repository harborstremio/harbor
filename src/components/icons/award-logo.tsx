import { allAwardSources, awardSourceMeta, type AwardSourceId } from "@/lib/anime-awards";
import { AWARD_ICON_REGISTRY, useAwardIcon } from "@/lib/award-icons";

const ANIME_CATEGORY_KEYS = new Set<string>(
  AWARD_ICON_REGISTRY.find((g) => g.title === "Anime categories")?.items.map((i) => i.key) ?? [],
);

const BUNDLED_AWARD_ICONS: Record<string, string> = {
  blue_dragon: "/awards/blue_dragon.png",
  baeksang: "/awards/baeksang.png",
  venice: "/awards/venice.webp",
  berlin: "/awards/berlin.png",
  cesar: "/awards/cesar.png",
  goya: "/awards/goya.png",
  annie: "/awards/annie.png",
  spirit: "/awards/spirit.png",
  saturn: "/awards/saturn.png",
  bifa: "/awards/bifa.png",
};

export function defaultAwardIcon(type: string): string {
  const bundled = BUNDLED_AWARD_ICONS[type];
  if (bundled) return bundled;
  const sources = allAwardSources() as string[];
  if (sources.includes(type)) return awardSourceMeta(type as AwardSourceId).iconSmall;
  if (type.endsWith("_logo")) {
    const base = type.slice(0, -5);
    if (sources.includes(base)) return awardSourceMeta(base as AwardSourceId).icon;
  }
  if (ANIME_CATEGORY_KEYS.has(type)) return awardSourceMeta("crunchyroll").iconSmall;
  return "/awards/trophy.png";
}

export function laurelColorFor(type: string): string {
  switch (type) {
    case "oscar":
      return "#D4AF37";
    case "emmy":
      return "#D4AF37";
    case "golden_globe":
      return "#D4AF37";
    case "bafta":
      return "#CA9200";
    case "bafta_tv":
      return "#CA9200";
    case "annie":
      return "#E0A93E";
    case "spirit":
      return "#3E8ED0";
    case "saturn":
      return "#9AA5B1";
    case "cesar":
      return "#C9A227";
    case "goya":
      return "#8C6A3F";
    case "blue_dragon":
      return "#3E7BD0";
    case "baeksang":
      return "#C9A227";
    case "bifa":
      return "#B8B8B8";
    case "critics_choice":
      return "#CE8819";
    case "sag":
      return "#B08D57";
    case "cannes":
      return "#DAA520";
    case "venice":
      return "#DAA520";
    case "berlin":
      return "#BFBFBF";
    default:
      return "#D4AF37";
  }
}

export function AwardLogo({ type, size = 22 }: { type: string; size?: number }) {
  const custom = useAwardIcon(type);
  return (
    <img
      src={custom ?? defaultAwardIcon(type)}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ height: size * 1.15, width: "auto" }}
    />
  );
}
