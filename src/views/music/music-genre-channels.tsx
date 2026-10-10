import { useEffect, useState } from "react";
import { MusicVideoDiscovery } from "@/components/music/music-video-discovery";
import { useT } from "@/lib/i18n";
import { genreChannels } from "@/lib/music/genre-channels";
import type { MusicDiscoveryGenre } from "@/lib/music/genre-catalog";
import type { MusicTrack } from "@/lib/music/types";
import "./music-genre-channels.css";

export function MusicGenreChannels({
  genre,
  active,
  onWatch,
}: {
  genre: MusicDiscoveryGenre;
  active: boolean;
  onWatch: (track: MusicTrack, queue: MusicTrack[]) => void;
}) {
  const t = useT();
  const channels = genreChannels(genre);
  const [at, setAt] = useState(0);
  useEffect(() => {
    setAt(0);
  }, [genre.id]);
  if (!channels.length) return null;
  const chosen = channels[Math.min(at, channels.length - 1)];

  return (
    <MusicVideoDiscovery
      key={`channels:${genre.id}`}
      titleKey="music.videos.studios"
      query={chosen.query}
      active={active}
      onWatch={onWatch}
      headerContent={
        <div className="music-genre-channel-picker" role="group" aria-label={t("music.explore.scene")}>
          {channels.map((channel, index) => (
            <button
              key={channel.name}
              type="button"
              aria-pressed={index === at}
              onClick={() => setAt(index)}
            >
              {channel.logo ? (
                <img className="music-genre-channel-logo" src={channel.logo} alt="" loading="lazy" />
              ) : (
                <span className="music-genre-channel-logo" data-monogram aria-hidden>
                  {channel.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}
                </span>
              )}
              {channel.name}
            </button>
          ))}
        </div>
      }
    />
  );
}
