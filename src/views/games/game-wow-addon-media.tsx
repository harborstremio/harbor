import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadWowAddonMedia } from "@/lib/games/wow-addon-media";
import type { WowAddonMedia } from "@/lib/games/wow-addon-media-data";
import { GameArt } from "./game-art";
import { GameWowAddonNotes } from "./game-wow-addon-notes";

export function GameWowAddonMedia({ id, active }: { id: number; active: boolean }) {
  const t = useT();
  const [data, setData] = useState<WowAddonMedia | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); setFailed(false);
    void loadWowAddonMedia(id, controller.signal).then(value => { if (!controller.signal.aborted) { setData(value.data); setSelected(0); } }, () => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, active, attempt]);
  const shown = data?.id === id ? data : null, item = shown?.images[selected];
  if (shown && !shown.images.length && !shown.description && !shown.changeLog && !shown.version && !shown.author) return null;
  return <section className="games-wow-addon-media" aria-label={t("games.wow.addons.preview")}>
    {(!shown || !!shown.images.length) && <h3>{t("games.wow.addons.screenshots")}<span>WoWInterface</span></h3>}
    {failed ? <p role="status">{t("games.wow.addons.previewUnavailable")} <button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p> : !shown ? <div className="games-detail-skeleton games-wow-addon-media-loading" aria-busy="true" aria-label={t("common.loading")}/> : item && <>
      <figure><GameArt key={item.image} src={item.image} alt={item.description || t("games.screenshot", { number: selected + 1 })} eager/><figcaption><span dir="auto">{item.description || t("games.screenshot", { number: selected + 1 })}</span><a href={item.image} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(item.image); }}>{t("games.wow.addons.originalImage")}<ArrowUpRight size={14}/></a></figcaption></figure>
      {shown.images.length > 1 && <div className="games-wow-addon-media-thumbnails">{shown.images.map((image, index) => <button key={image.image} type="button" aria-pressed={selected === index} aria-label={t("games.screenshot", { number: index + 1 })} onClick={() => setSelected(index)}><GameArt src={image.thumbnail}/></button>)}</div>}
    </>}
    {shown && <GameWowAddonNotes key={shown.id} data={shown}/>}
  </section>;
}
