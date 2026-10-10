import { useT, useUiLanguage } from "@/lib/i18n";
import { parseAudience } from "@/lib/music/artist-popularity";
import { peekArtistIdentity } from "@/lib/music/artist-authority";
import type { MusicArtistRef } from "@/lib/music/types";
import { MusicServiceLogo } from "./music-service-logo";

export function MusicSearchAudience({ artist }: { artist: MusicArtistRef }) {
  const t = useT();
  const language = useUiLanguage();
  const known = peekArtistIdentity(artist.name).ranking?.clusters.flatMap((cluster) => cluster.members)
    .find((member) => member.id === artist.id && member.connectorId === artist.connectorId);
  const parsed = parseAudience(artist.subtitle?.replace(t("music.metadata.deezerFans"), "fans"));
  const deezer = artist.id.startsWith("deezer:artist:") || parsed?.unit === "fans";
  const count = deezer && known?.metric ? known.metric : parsed?.value;
  if (!count) return artist.subtitle ? <span className="truncate text-xs text-ink-subtle">{artist.subtitle}</span> : null;
  const compact = new Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 }).format(count);
  const label = deezer ? `${compact} ${t("music.metadata.deezerFans")}`
    : artist.subtitle?.replace(/\d[\d.,]*\s*[kmb]?/i, compact) ?? compact;
  return <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-muted" title={artist.subtitle || `${count.toLocaleString(language)} ${t("music.metadata.deezerFans")}`}>
    <MusicServiceLogo source={deezer ? "deezer" : artist.connectorId} size={13} />
    <span className="truncate">{label}</span>
  </span>;
}
