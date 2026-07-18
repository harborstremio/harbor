export type AnimeStreamerInfo = {
  logo?: string;
  brandColor: string;
  textColor?: string;
};

const FALLBACK: AnimeStreamerInfo = { brandColor: "#a4906a" };

export function animeStreamerInfo(name: string): AnimeStreamerInfo {
  const k = name.toLowerCase();
  if (k.includes("crunchyroll"))
    return { logo: "/services/crunchyroll.svg", brandColor: "#F47521" };
  if (k.includes("funimation")) return { brandColor: "#5B0BB5", textColor: "#ffffff" };
  if (k.includes("netflix")) return { logo: "/services/netflix.svg", brandColor: "#E50914" };
  if (k.includes("hulu")) return { logo: "/services/hulu.svg", brandColor: "#1CE783" };
  if (k.includes("hidive")) return { logo: "/services/hidive.png", brandColor: "#00AEEF" };
  if (k.includes("amazon") || k.includes("prime"))
    return { logo: "/services/prime.svg", brandColor: "#00A8E1" };
  if (k.includes("disney")) return { logo: "/services/disney.svg", brandColor: "#0E47A1" };
  if (k.includes("youtube"))
    return { logo: "/services/youtube.png", brandColor: "#FF0000", textColor: "#ffffff" };
  if (k.includes("vrv")) return { brandColor: "#FFE800", textColor: "#000000" };
  if (k.includes("tubi")) return { brandColor: "#FA382F", textColor: "#ffffff" };
  if (k.includes("hoopla")) return { brandColor: "#005DAA", textColor: "#ffffff" };
  if (k.includes("kanopy")) return { brandColor: "#000000", textColor: "#ffffff" };
  if (k.includes("apple")) return { logo: "/services/apple.svg", brandColor: "#FFFFFF" };
  if (k.includes("max")) return { logo: "/services/max.svg", brandColor: "#9B6CFF" };
  return FALLBACK;
}
