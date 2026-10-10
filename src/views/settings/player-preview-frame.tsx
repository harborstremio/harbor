import type { ReactNode } from "react";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { PRODUCT_NAME } from "@/lib/i18n/brand";

export function PlayerPreviewFrame({ children, note, windowed = false, imageSrc, imagePosition = "center", sampleIndex = 3 }: {
  children?: ReactNode;
  note?: ReactNode;
  windowed?: boolean;
  imageSrc?: string;
  imagePosition?: string;
  sampleIndex?: number;
}) {
  const art = useSampleArtwork(sampleIndex);
  return (
    <figure className="hset-player-preview">
      <div className="hset-player-preview-screen" aria-hidden inert>
        {windowed && <div className="hset-player-preview-titlebar"><span>{PRODUCT_NAME}</span><span>− &nbsp; □ &nbsp; ×</span></div>}
        <div className="hset-player-preview-picture">
          <img src={imageSrc || art.background} alt="" draggable={false} style={{ objectPosition: imagePosition }} />
          {children}
        </div>
        {windowed && <div className="hset-player-preview-taskbar"><span /><span /><span /></div>}
      </div>
      {note && <figcaption>{note}</figcaption>}
    </figure>
  );
}
