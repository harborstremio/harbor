import { useT } from "@/lib/i18n";
import {
  MUSIC_DOCK_PARTS,
  MUSIC_DOCK_PART_LABELS,
  resetMusicDockLayout,
  setMusicDockLayout,
  useMusicDockLayout,
} from "@/lib/music/dock-layout";

export function MusicDockParts() {
  const t = useT();
  const layout = useMusicDockLayout();
  const hidden = MUSIC_DOCK_PARTS.filter((part) => !layout[part]).length;

  return (
    <section className="music-audio-section">
      <div className="music-audio-row">
        <label>{t("music.dock.parts.title")}</label>
        <button type="button" onClick={resetMusicDockLayout} disabled={hidden === 0}>
          {t("music.audio.reset")}
        </button>
      </div>
      <p>{t("music.dock.parts.body")}</p>
      <div className="music-dock-parts">
        {MUSIC_DOCK_PARTS.map((part) => (
          <label key={part} className="music-audio-toggle">
            <input
              type="checkbox"
              checked={layout[part]}
              onChange={(event) => setMusicDockLayout({ [part]: event.target.checked })}
            />
            {t(MUSIC_DOCK_PART_LABELS[part])}
          </label>
        ))}
      </div>
    </section>
  );
}
