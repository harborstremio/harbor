import { useState, type ReactNode } from "react";
import { Music2 } from "@/components/icons/music-icons";
import jellyfinLogo from "@/assets/service-logos/jellyfin.png";
import plexLogo from "@/assets/service-logos/plex.png";
import youtubeLogo from "@/assets/service-logos/youtube.ico";

// Compact marks from the services' own sites, with existing bundled art as backup.
const LOGOS: Record<string, readonly string[]> = {
  spotify: ["https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png"],
  youtube: ["https://music.youtube.com/favicon.ico", youtubeLogo],
  youtubemusic: ["https://music.youtube.com/favicon.ico", youtubeLogo],
  soundcloud: ["https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-c93ce58b59.ico"],
  deezer: [
    "https://cdn-files.dzcdn.net/cache/images/common/favicon/favicon.5e8e3be4042b873a7358.ico",
  ],
  billboard: [
    "https://www.billboard.com/wp-content/themes/vip/pmc-billboard-2021/assets/app/icons/favicon.png",
  ],
  rollingstone: [
    "https://www.rollingstone.com/wp-content/themes/vip/pmc-rollingstone-2022/assets/app/icons/apple-touch-icon.png",
    "https://www.rollingstone.com/favicon.ico",
  ],
  plex: ["https://watch.plex.tv/icons/favicon.ico", plexLogo],
  jellyfin: ["https://jellyfin.org/images/favicon.ico", jellyfinLogo],
  navidrome: ["https://www.navidrome.org/favicons/favicon.ico"],
  subsonic: ["https://www.subsonic.org/pages/inc/img/favicon.png"],
  lastfm: ["https://www.last.fm/static/images/lastfm_avatar_applemusic.b06eb8ad89be.png"],
  listenbrainz: ["https://listenbrainz.org/static/img/listenbrainz_logo_icon.svg"],
};

export function MusicServiceLogo({
  source,
  itemId,
  size = 22,
  fallback,
  className = "",
}: {
  source: string;
  itemId?: string;
  size?: number;
  fallback?: ReactNode;
  className?: string;
}) {
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  // Open catalog can contain Deezer, MusicBrainz, and iTunes items.
  const service = normalized === "catalog" ? (itemId?.split(":")[0] ?? normalized) : normalized;
  const [failed, setFailed] = useState<string[]>([]);
  const urls = Object.hasOwn(LOGOS, service) ? LOGOS[service] : undefined;
  const url = urls?.find((candidate) => !failed.includes(candidate));
  if (!url) return <>{fallback ?? <Music2 size={size} aria-hidden />}</>;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 select-none object-contain ${service === "soundcloud" ? "rounded-[20%]" : ""} ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() =>
        setFailed((previous) => (previous.includes(url) ? previous : [...previous, url]))
      }
    />
  );
}
