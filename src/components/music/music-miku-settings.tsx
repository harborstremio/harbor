import { Dropdown } from "@/components/dropdown";
import { MIKU_MODELS, normalizeMikuModel } from "@/lib/music/miku-models";
import { useT } from "@/lib/i18n";
import { setMusicAppearance, useMusicAppearance } from "@/lib/music/appearance";
import { openUrl } from "@/lib/window";
import { MikuArtwork } from "./music-miku-visualizer";
import "./music-miku-settings.css";

export function MusicMikuSettings() {
  const t = useT();
  const appearance = useMusicAppearance();
  return (
    <section className="music-audio-section music-miku-settings" aria-labelledby="music-miku-title">
      <div className="music-miku-preview"><MikuArtwork /></div>
      <div className="music-miku-copy">
        <label className="music-audio-toggle" id="music-miku-title">
          <input type="checkbox" checked={appearance.mikuVisualizer}
            onChange={event => setMusicAppearance({ mikuVisualizer: event.target.checked, ...(event.target.checked ? { gifVisualizer: false } : {}) })} />
          {t("music.miku.title")}
        </label>
        <p>{t("music.miku.body")}</p>
        <p>{t("music.miku.rest")}</p>
        <div className="music-miku-model">
          <span>{t("music.miku.model")}</span>
          <Dropdown value={appearance.mikuModel} ariaLabel={t("music.miku.model")}
            options={MIKU_MODELS.map(value => ({ value, label: t(`music.miku.model.${value}`) }))}
            onChange={value => setMusicAppearance({ mikuModel: normalizeMikuModel(value) })} />
        </div>
        <details className="music-miku-license">
          <summary>{t("music.miku.credits")}</summary>
          <p>Hatsune Miku, © Crypton Future Media, Inc. 2007.</p>
          {appearance.mikuModel === "classic" && <p>{t("music.miku.adaptation")}</p>}
          <p>{t("music.miku.noncommercial")}</p>
          <div className="music-miku-links">
            <button type="button" onClick={() => void openUrl("https://creativecommons.org/licenses/by-nc/3.0/legalcode")}>CC BY-NC 3.0 ↗</button>
            <button type="button" onClick={() => void openUrl("https://piapro.net/intl/en_for_creators.html")}>{t("music.miku.guidelines")} ↗</button>
            {appearance.mikuModel === "classic" && <button type="button" onClick={() => void openUrl("https://sites.google.com/view/evpvp/")}>MikuMikuDance ↗</button>}
          </div>
        </details>
      </div>
    </section>
  );
}
