import { Search } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { normalizeName } from "@/lib/music/search-normalize";
import "./music-playlist-picker.css";

export function matchesPlaylistSearch(name: string, query: string): boolean {
  const title = normalizeName(name);
  return normalizeName(query).split(" ").filter(Boolean).every(word => title.includes(word));
}

export function MusicPlaylistSearch({ query, onChange }: { query: string; onChange: (query: string) => void }) {
  const t = useT();
  return <label className="music-playlist-destination-search"><Search size={17} aria-hidden />
    <input type="search" value={query} onChange={event => onChange(event.target.value)} placeholder={t("music.playlist.search")} aria-label={t("music.playlist.search")} />
  </label>;
}
