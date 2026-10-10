import { ListMusic } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { requestMusicLibrary } from "@/lib/music/navigation";
import { MUSIC_SOURCE_REQUIRED, resolveAndPlayMusicTrack } from "@/lib/music/play-track";
import { useMusicPlayer } from "@/lib/music/player";
import { useView } from "@/lib/view";

export function MusicQuickStrip({ onLeave }: { onLeave: () => void }) {
  const t = useT();
  const { setView } = useView();
  const player = useMusicPlayer();
  const tracks = player.recents.slice(0, 24);

  const go = (run: () => void) => {
    onLeave();
    setView("music");
    run();
  };

  return (
    <>
      <div className="game-dock-row">
        <HoverTooltip
          label={t("music.quick.playlists")}
          sublabel={t("music.quick.playlistsNote")}
          align="end"
          delayMs={230}
        >
          <button
            className="game-dock-open music-quick-pin"
            aria-label={t("music.quick.playlists")}
            onClick={() => go(() => requestMusicLibrary({ view: "playlists" }))}
          >
            <ListMusic size={23} />
          </button>
        </HoverTooltip>
      </div>
      {tracks.map((track) => (
        <div key={`${track.connectorId}:${track.id}`} className="game-dock-row">
          <HoverTooltip
            label={track.title}
            sublabel={track.artist}
            mark={
              track.artwork ? (
                <img className="game-dock-tooltip-art" src={track.artwork} alt="" loading="lazy" />
              ) : (
                <ListMusic size={32} />
              )
            }
            large
            align="end"
            delayMs={230}
          >
            <button
              className="game-dock-open"
              aria-label={t("music.quick.play", { name: track.title })}
              onClick={() => {
                void resolveAndPlayMusicTrack(track, tracks).then((result) => {
                  if (!result) window.dispatchEvent(new Event(MUSIC_SOURCE_REQUIRED));
                });
              }}
            >
              {track.artwork ? (
                <img src={track.artwork} alt="" loading="lazy" draggable={false} />
              ) : (
                <ListMusic size={25} />
              )}
            </button>
          </HoverTooltip>
        </div>
      ))}
      {tracks.length === 0 && (
        <HoverTooltip label={t("music.quick.empty")} sublabel={t("music.quick.emptyNote")} align="end">
          <button
            className="game-dock-empty"
            aria-label={t("music.quick.empty")}
            onClick={() => go(() => requestMusicLibrary({ view: "playlists" }))}
          >
            <ListMusic size={24} />
          </button>
        </HoverTooltip>
      )}
    </>
  );
}
