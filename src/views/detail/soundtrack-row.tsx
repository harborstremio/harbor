import type { FilmSoundtrack } from "@/lib/providers/musicbrainz-soundtrack";
import { useView } from "@/lib/view";

export function SoundtrackRow({ album }: { album: FilmSoundtrack }) {
  const { setView } = useView();
  const open = () => {
    setView("music");
    void Promise.all([
      import("@/lib/music/navigation"),
      import("@/lib/music/deep-link"),
    ]).then(([{ requestMusicSearch }, { musicDeepLinkQuery }]) =>
      requestMusicSearch(
        musicDeepLinkQuery({ kind: "album", artist: album.artist, name: album.title }).trim(),
      ),
    );
  };
  return (
    <button
      type="button"
      onClick={open}
      className="rounded-md text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
    >
      {album.title}
    </button>
  );
}
