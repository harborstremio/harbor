import { useRef, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { setMusicAppearance, useMusicAppearance } from "@/lib/music/appearance";
import { normalizeGifTiming } from "@/lib/music/gif-clock";
import { MAX_GIF_BYTES } from "@/lib/music/gif-frames";
import { decodeGifFile, deleteMusicGif, rememberMusicGif, saveMusicGif, useMusicGif } from "@/lib/music/gif-asset";
import { MusicGifCanvas } from "./music-gif-visualizer";
import "./music-miku-settings.css";

export function MusicGifSettings() {
  const t = useT(), appearance = useMusicAppearance(), asset = useMusicGif(appearance.gifId);
  const input = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (file.size > MAX_GIF_BYTES) throw new Error("large");
      const animation = await decodeGifFile(file), id = crypto.randomUUID();
      await saveMusicGif({ id, name: file.name, blob: file });
      rememberMusicGif(id, animation);
      const previous = appearance.gifId;
      setMusicAppearance({ gifId: id, gifName: file.name, gifVisualizer: true, mikuVisualizer: false });
      if (previous) void deleteMusicGif(previous).catch(() => {});
    } catch (failure) {
      setError(failure instanceof Error && ["large", "storage"].includes(failure.message) ? failure.message : "invalid");
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async () => {
    if (!appearance.gifId) return;
    setBusy(true); setError("");
    try {
      await deleteMusicGif(appearance.gifId);
      setMusicAppearance({ gifId: null, gifName: "", gifVisualizer: false });
      requestAnimationFrame(() => uploadButton.current?.focus());
    } catch { setError("storage"); }
    finally { setBusy(false); }
  };
  return <section className="music-audio-section music-miku-settings" aria-labelledby="music-gif-title">
    <div className="music-gif-preview">{asset?.frames && <MusicGifCanvas animation={asset.frames} />}</div>
    <div className="music-miku-copy">
      <label className="music-audio-toggle" id="music-gif-title">
        <input type="checkbox" checked={appearance.gifVisualizer} disabled={!appearance.gifId || busy || !!asset?.error}
          onChange={event => setMusicAppearance({ gifVisualizer: event.target.checked, ...(event.target.checked ? { mikuVisualizer: false } : {}) })} />
        {t("music.gif.title")}
      </label>
      <p>{t("music.gif.body")}</p>
      <p>{t("music.gif.timingHelp")}</p>
      <input ref={input} type="file" accept="image/gif,.gif" hidden onChange={event => void upload(event.target.files?.[0])} />
      <div className="music-gif-actions">
        <button ref={uploadButton} type="button" disabled={busy} onClick={() => input.current?.click()}>{t(busy ? "music.gif.loading" : appearance.gifId ? "music.gif.replace" : "music.gif.upload")}</button>
        {appearance.gifId && <button type="button" disabled={busy} onClick={() => void remove()}>{t("music.gif.remove")}</button>}
      </div>
      {appearance.gifName && <bdi className="music-gif-filename">{appearance.gifName}</bdi>}
      {(error || asset?.error) && <p role="alert" className="music-gif-error">{t(`music.gif.error.${error || "missing"}`)}</p>}
      {appearance.gifId && <div className="music-gif-controls">
        <label>{t("music.gif.size")}<input type="range" min="64" max="220" step="2" value={appearance.gifSize} aria-label={t("music.gif.size")}
          onChange={event => setMusicAppearance({ gifSize: Number(event.target.value) })} /></label>
        <span>{t("music.gif.loop")}</span>
        <Dropdown value={appearance.gifTiming} ariaLabel={t("music.gif.loop")}
          options={["auto", "1", "2", "4", "8"].map(value => ({ value, label: t(`music.gif.loop.${value}`) }))}
          onChange={value => setMusicAppearance({ gifTiming: normalizeGifTiming(value) })} />
      </div>}
    </div>
  </section>;
}
