import { Clock3, Heart } from "@/components/icons/music-icons";
import { MusicSurpriseIcon } from "./music-surprise-icon";
import "./music-collection-grid.css";

export function MusicPinnedCover({ kind, artwork, glyphSize = 34 }: { kind: "liked" | "recent" | "surprise"; artwork: string[]; glyphSize?: number }) {
  return (
    <span className="music-collection-pinned" data-pinned={kind}>
      {artwork.length > 0 && (
        <span className="music-collection-pinned-wash">
          {artwork.slice(0, 4).map((art, index) => (
            <img key={`${art}-${index}`} src={art} alt="" draggable={false} loading="lazy" />
          ))}
        </span>
      )}
      {kind === "surprise" ? <MusicSurpriseIcon size={glyphSize} /> : kind === "liked" ? <Heart size={glyphSize} /> : <Clock3 size={glyphSize} />}
    </span>
  );
}
