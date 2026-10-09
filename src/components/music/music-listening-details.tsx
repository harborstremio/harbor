import { useEffect, useState } from "react";
import { ArrowUpRight } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { resolveArtist } from "@/lib/music/artist-authority";
import { useRecordingProfile } from "@/lib/music/use-recording-profile";
import type { RecordingProfile } from "@/lib/music/recording-profile";
import type { MusicArtistRef, MusicTrack } from "@/lib/music/types";
import { MusicArtistOverview, MusicWhereToBuy } from "./music-artist-overview";
import { MusicSoundtrackLink } from "./music-soundtrack-link";
import "./music-listening-details.css";

export function MusicCredits({
  profile,
  onArtist,
}: {
  profile: RecordingProfile | null;
  onArtist: (artist: MusicArtistRef) => void;
}) {
  const t = useT();
  if (!profile?.credits.length) return null;
  const roles: Record<string, string> = {
    "main artist": "main",
    "featured artist": "featured",
    composer: "composer",
    lyricist: "lyricist",
    producer: "producer",
    performer: "performer",
    vocal: "performer",
    instrument: "performer",
  };
  const sources = [
    ...new Map(profile.credits.map((credit) => [credit.source, credit.sourceUrl])).entries(),
  ];
  return (
    <section className="music-recording-credits">
      <header>
        <h2>{t("music.credits.title")}</h2>
        {sources.map(([name, url]) => (
          <button type="button" key={name} onClick={() => openUrl(url)}>
            {name}
            <ArrowUpRight size={13} />
          </button>
        ))}
      </header>
      <div>
        {profile.credits.map((credit, index) => (
          <button
            type="button"
            key={`${credit.artist.id}:${credit.role}:${index}`}
            onClick={() => onArtist(credit.artist)}
          >
            <span>
              <strong>{credit.name}</strong>
              <small>
                {roles[credit.role.toLowerCase()]
                  ? t(`music.credits.${roles[credit.role.toLowerCase()]}`)
                  : credit.role}
                {credit.attributes?.length ? ` · ${credit.attributes.join(", ")}` : ""}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function MusicTrackCredits({
  track,
  onArtist,
}: {
  track: MusicTrack;
  onArtist: (artist: MusicArtistRef) => void;
}) {
  const { profile } = useRecordingProfile(track);
  return <MusicCredits profile={profile} onArtist={onArtist} />;
}

export function MusicListeningDetails({
  track,
  profile,
  onArtist,
}: {
  track: MusicTrack;
  profile: RecordingProfile | null;
  onArtist: (artist: MusicArtistRef) => void;
}) {
  const [resolved, setResolved] = useState<{ key: string; artist: MusicArtistRef | null } | null>(
    null,
  );
  const key = `${track.connectorId}:${track.id}:${track.artist}`;
  const knownArtist = profile?.primaryArtist;
  useEffect(() => {
    if (knownArtist) return;
    let alive = true;
    void resolveArtist(track.artist, { track })
      .then((ranking) => {
        if (alive) setResolved({ key, artist: ranking.canonical });
      })
      .catch(() => {
        if (alive) setResolved({ key, artist: null });
      });
    return () => {
      alive = false;
    };
  }, [key, knownArtist?.id]);
  const artist = knownArtist ?? (resolved?.key === key ? resolved.artist : null);
  return (
    <div className="music-listening-details">
      <MusicSoundtrackLink
        title={track.title}
        album={track.album}
        release={profile?.album?.title}
      />
      {artist && <MusicArtistOverview artist={artist} onOpen={onArtist} compact />}
      <MusicCredits profile={profile} onArtist={onArtist} />
      <MusicWhereToBuy item={{ ...track, kind: "track" }} />
    </div>
  );
}
