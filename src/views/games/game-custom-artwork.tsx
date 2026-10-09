import { useEffect, useState } from "react";
import { ImagePlus, Images } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useT } from "@/lib/i18n";
import { useGameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import type { CustomGameLibrary } from "@/hooks/use-custom-game-library";
import type { CustomGame } from "@/lib/games/custom-library";
import { artworkBinding, type LibraryArtwork } from "@/lib/games/igdb-artwork";
import type { LibraryMetadataMatch } from "@/lib/games/library-metadata";
import { GameArt } from "./game-art";
import { GameArtworkPicker } from "./game-artwork-picker";

export function CustomGameArtwork({ game, library, disabled }: { game: CustomGame; library: CustomGameLibrary; disabled: boolean }) {
  const t = useT(), preferences = useGameLibraryPreferences(library.profile, true);
  const id = `custom:${game.id}`, value = preferences.get(id), binding = artworkBinding(id, game.linked ?? undefined, value.metadata?.igdbId);
  const [review, setReview] = useState<{ profile: string; binding: string; artwork?: LibraryArtwork; metadata?: LibraryMetadataMatch } | null>(null);
  const image = game.artwork ? convertFileSrc(game.artwork) : preferences.cover(id, game.linked ?? undefined) ?? game.linked?.portrait ?? game.linked?.capsule;
  useEffect(() => { setReview(null); }, [library.profile, game.id, binding]);
  const busy = disabled || preferences.busy;
  return <>
    <div className="games-custom-artwork-setting">
      {image && <GameArt src={image}/>}
      <button className="games-button" disabled={busy} onClick={() => void library.chooseArtwork(game, t("games.custom.artwork"))}><ImagePlus size={18}/>{t("games.custom.artwork")}</button>
      {game.linked && <button className="games-button" disabled={busy || !preferences.ready} onClick={() => { preferences.dismissError(); setReview({ profile: library.profile, binding, artwork: value.artwork, metadata: value.metadata }); }}><Images size={18}/>{t("games.artwork.browse")}</button>}
      {game.artwork && <button className="games-button" disabled={busy} onClick={() => void library.update(game.id, { artwork: null })}>{t("games.custom.resetArt")}</button>}
    </div>
    {preferences.error && !review && <p className="games-custom-error" role="alert">{t(preferences.error)}</p>}
    {review && review.profile === library.profile && review.binding === binding && game.linked && <GameArtworkPicker game={game.linked} binding={binding} value={review.artwork} localCover={!!game.artwork || !!value.cover} error={preferences.error} onSave={next => preferences.updateArtwork(id, next, review.artwork, review.metadata)} onClose={() => setReview(null)}/>}
  </>;
}
