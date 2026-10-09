import { Disc3, FolderOpen, ListMusic, SlidersHorizontal, UserRound } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";

export function MusicLibraryEmptyState({
  kind = "playlists",
  onConnect,
  onTastes,
}: {
  kind?: "albums" | "artists" | "tracks" | "playlists";
  onConnect: () => void;
  onTastes: () => void;
}) {
  const t = useT();
  const Icon = kind === "artists" ? UserRound : kind === "tracks" || kind === "playlists" ? ListMusic : Disc3;
  return (
    <div className="music-library-start">
      <div className="music-library-start-art" data-kind={kind} aria-hidden="true">
        <span /><span /><span><Icon size={48} /></span>
      </div>
      <div className="music-library-start-copy">
        <h3>{t("music.taste.choose")}</h3>
        <p>{t("music.taste.body")}</p>
        <div className="music-library-actions">
          <button type="button" className="music-library-button" onClick={onTastes}>
            <SlidersHorizontal size={18} aria-hidden="true" />
            {t("music.taste.choose")}
          </button>
          <button type="button" className="music-library-text" onClick={onConnect}>
            <FolderOpen size={18} aria-hidden="true" />
            {t("music.home.addFolder")}
          </button>
        </div>
        <p className="music-library-start-hint">{t("music.library.localEmpty")}</p>
      </div>
    </div>
  );
}
