import type { ReactNode } from "react";
import filmStill from "@/assets/settings-preview/the-toll-of-the-sea.webp";

export function PlayerPreviewFrame({ children, note, windowed = false, imageSrc = filmStill, imagePosition = "center" }: {
  children?: ReactNode;
  note?: ReactNode;
  windowed?: boolean;
  imageSrc?: string;
  imagePosition?: string;
}) {
  return (
    <figure className="hset-player-preview">
      <div className="hset-player-preview-screen" aria-hidden inert>
        {windowed && <div className="hset-player-preview-titlebar"><span>Harbor</span><span>− &nbsp; □ &nbsp; ×</span></div>}
        <div className="hset-player-preview-picture">
          <img src={imageSrc} alt="" draggable={false} style={{ objectPosition: imagePosition }} />
          {children}
        </div>
        {windowed && <div className="hset-player-preview-taskbar"><span /><span /><span /></div>}
      </div>
      {note && <figcaption>{note}</figcaption>}
    </figure>
  );
}
