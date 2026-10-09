import { useState } from "react";
import { useT } from "@/lib/i18n";
import { SimsMtsArt } from "./game-sims-mts-art";
import { ChevronLeft, ChevronRight, Maximize } from "lucide-react";
import { GameScreenshotViewer } from "./game-screenshot-viewer";

export function SimsMtsGallery({ images }: { images: string[] }) {
  const [selected, setSelected] = useState(0), [expanded, setExpanded] = useState(false), t = useT();
  const current = Math.min(selected, Math.max(0, images.length - 1));
  return <div className="mods-project-gallery">
    <div className="mod-gallery-stage">
      <button className="mod-gallery-open" disabled={!images.length} aria-label={t("games.gallery.enlargeImage", { number: current + 1 })} onClick={() => setExpanded(true)}><SimsMtsArt key={images[current]} src={images[current] ?? ""}/><span><Maximize size={22}/></span></button>
      {images.length > 1 && <div className="mod-gallery-arrows"><button aria-label={t("common.previous")} onClick={() => setSelected((current + images.length - 1) % images.length)}><ChevronLeft size={26}/></button><button aria-label={t("common.next")} onClick={() => setSelected((current + 1) % images.length)}><ChevronRight size={26}/></button></div>}
    </div>
    {images.length > 1 && <div className="mods-project-thumbnails" aria-label={t("games.minecraft.catalog.gallery")}>{images.map((image, index) => <button key={image} aria-label={`${t("games.minecraft.catalog.gallery")} ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={image} alt="" loading="lazy" decoding="async"/></button>)}</div>}
    {expanded && images.length > 0 && <GameScreenshotViewer screenshots={images} index={current} select={setSelected} onClose={() => setExpanded(false)}/>}
  </div>;
}
