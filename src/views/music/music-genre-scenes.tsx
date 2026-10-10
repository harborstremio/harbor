import { musicGenreName } from "@/lib/music/genre-catalog";
import { Row } from "@/components/row";
import { MusicDiscoveryIcon } from "@/components/music/music-discovery-icon";
import { useT } from "@/lib/i18n";
import { MUSIC_GENRE_ARTWORK } from "@/lib/music/genre-artwork";
import { genreSceneBranches } from "@/lib/music/genre-scenes";
import type { MusicDiscoveryGenre } from "@/lib/music/genre-catalog";

export function MusicGenreScenes({ genre, onSelect }: {
  genre: MusicDiscoveryGenre;
  onSelect: (genre: MusicDiscoveryGenre) => void;
}) {
  const t = useT();
  const scenes = genreSceneBranches(genre);
  if (!scenes.length) return null;
  // This short row keeps its compact cards mounted; square poster skeletons are taller.
  // The artwork still loads lazily through the image elements.
  return <Row key={genre.id} title={t("music.explore.subgenres")} shape="square" min={170} alwaysActive scrollKey={`music:genre-scenes:${genre.id}`}>
    {scenes.map(scene => <button key={scene.id} type="button" className="music-genre-scene-card" onClick={() => onSelect(scene)}>
      <img src={MUSIC_GENRE_ARTWORK[scene.id]} alt="" loading="lazy"/>
      <MusicDiscoveryIcon genreId={scene.id}/>
      <strong>{musicGenreName(scene, t)}</strong>
    </button>)}
  </Row>;
}
