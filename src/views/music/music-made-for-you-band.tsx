import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play } from "@/components/icons/music-icons";
import { MUSIC_SHELF_MIN } from "@/components/music/music-catalog-row";
import { MusicMixCover } from "@/components/music/music-mix-cover";
import { MusicNowPlayingMark } from "@/components/music/music-now-playing-mark";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { Row } from "@/components/row";
import { activeProfileId } from "@/lib/active-profile-id";
import { loadMadeForYou, readMadeForYouShelf, type MadeForYouMix } from "@/lib/music/made-for-you";
import { useLikedArtists } from "@/lib/music/liked-artists";
import { readListeningAffinity } from "@/lib/music/listening-affinity";
import { loadTastePool } from "@/lib/music/taste-pool";
import { filterBlockedTracks } from "@/lib/music/artist-blocks";
import { dailyDayKey } from "@/lib/music/daily-discovery-selection";
import { playMusic } from "@/lib/music/player";
import { recordMusicSimilarPlayback, useMusicPlaybackOrigin } from "@/lib/music/playback-origin";
import { musicRecentContextIdentity } from "@/lib/music/recent-identity";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";
import "@/components/music/music-cover-card.css";
import "./music-made-for-you-band.css";
import type { MusicBand, MusicBandContext } from "./music-band-types";

type Mix = MadeForYouMix;
type Translate = MusicBandContext["t"];

function mixName(mix: Mix, t: Translate): string {
  return mix.kind === "daily" ? t("music.madeForYou.mix", { index: mix.index }) : t("music.madeForYou.namedMix", { name: mix.name });
}

function MadeForYouRow({ player, t, title, openMix }: { player: MusicBandContext["player"]; t: Translate; title: string; openMix: MusicBandContext["openMix"] }) {
  const followed = useLikedArtists();
  const origin = useMusicPlaybackOrigin();
  const now = useMusicNowPlaying();
  const playing = origin?.kind === "similar" && (now.phase === "playing" || now.phase === "resolving") ? musicRecentContextIdentity(origin) : null;
  const inputs = useRef({ player, followed });
  inputs.current = { player, followed };
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [day, setDay] = useState(dailyDayKey);
  const [retry, setRetry] = useState(0);
  const [errored, setErrored] = useState(false);
  const hasTaste = !!(player.likedTracks.length || player.recents.length || followed.length);
  const profile = activeProfileId();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const checkDay = () => {
      clearTimeout(timer);
      const now = new Date();
      setDay(dailyDayKey(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(checkDay, midnight.getTime() - now.getTime() + 100);
    };
    checkDay();
    window.addEventListener("focus", checkDay);
    document.addEventListener("visibilitychange", checkDay);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", checkDay);
      document.removeEventListener("visibilitychange", checkDay);
    };
  }, []);
  useEffect(() => {
    let live = true;
    setMixes([]);
    setErrored(false);
    setLoadingPersonal(true);
    void readMadeForYouShelf(day, profile, hasTaste).then(async held => {
      if (held.length) return held;
      const pool = await loadTastePool().catch(() => ({ tracks: [], playlists: [] }));
      const { player, followed } = inputs.current;
      return loadMadeForYou({ recents: player.recents, liked: player.likedTracks, followed,
        library: [...pool.tracks, ...pool.playlists.flatMap(value => value.tracks)], affinity: readListeningAffinity(profile) },
        day, profile, value => { if (live) setMixes(value); });
    })
      .then(value => { if (live) setMixes(value); })
      .catch(() => { if (live) { setMixes([]); setErrored(true); } })
      .finally(() => { if (live) setLoadingPersonal(false); });
    return () => { live = false; };
  }, [hasTaste, day, profile, retry]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const open = async (mix: Mix, play = false) => {
    if (!play) {
      await openMix({ kind: "similar", id: mix.id, name: mixName(mix, t), artwork: mix.artwork, at: Date.now(), seed: mix.seeds[0] }, async () => filterBlockedTracks(filterBlockedTracks(mix.tracks, "show"), "play"));
      return;
    }
    const generation = ++request.current;
    setBusy(mix.id);
    setFailed(null);
    try {
      const tracks = filterBlockedTracks(filterBlockedTracks(mix.tracks, "show"), "play");
      if (request.current !== generation) return;
      if (!tracks.length) throw new Error("music.radio.error");
      recordMusicSimilarPlayback(tracks[0], tracks, {
        id: mix.id,
        name: mixName(mix, t),
      });
      await playMusic(tracks[0], tracks);
    } catch {
      if (request.current === generation) setFailed(mix.id);
    } finally {
      if (request.current === generation) setBusy(null);
    }
  };

  // Nothing to personalise from yet, so the band stays out of the way entirely rather
  // than showing an empty shelf. It appears once there are plays, likes or follows.
  if (!hasTaste && !mixes.length && !errored) return null;

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-busy={loadingPersonal}>
      <MusicSectionHead title={title} subtitle={t("music.madeForYou.subtitle")} />
      {!loadingPersonal && !mixes.length && errored && <div className="flex items-center gap-3 py-4 text-sm text-ink-muted" role="status">
        <span>{t("music.madeForYou.retry")}</span>
        <button type="button" className="rounded-md bg-elevated px-3 py-2 text-ink" onClick={() => setRetry(value => value + 1)}>{t("common.retry")}</button>
      </div>}
      <Row shape="square" min={MUSIC_SHELF_MIN} scrollKey="music:madeForYou" alwaysActive>
        {loadingPersonal && !mixes.length ? Array.from({ length: 6 }, (_, index) => <div key={index} aria-hidden="true" className="aspect-square rounded-md bg-elevated animate-pulse motion-reduce:animate-none" />) : mixes.map((mix) => (
          <div key={mix.id} data-mix-id={mix.id} className="music-mix-card music-cover-card group">
            <div className="relative">
              <button
                type="button"
                onClick={() => void open(mix)}
                aria-label={t("music.card.openItem", { title: mixName(mix, t) })}
                className="flex w-full min-w-0 flex-col text-start"
              >
                <MusicMixCover
                  artwork={mix.artwork}
                  index={mix.index}
                  label={mix.kind === "daily" ? t("music.madeForYou.badge") : mixName(mix, t)}
                  numbered={mix.kind === "daily"}
                  portrait={mix.kind === "artist"}
                  seed={mix.id}
                />
                <span className="mt-[9px] truncate text-[13px] font-semibold text-ink">
                  {mixName(mix, t)}
                </span>
              </button>
              <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
                {playing === musicRecentContextIdentity({ kind: "similar", id: mix.id, seed: mix.seeds[0] }) && <MusicNowPlayingMark loading={now.phase === "resolving"} />}
                <button
                  type="button"
                  className="music-cover-play no-press bg-ink text-canvas"
                  aria-label={t("music.card.playItem", { title: mixName(mix, t) })}
                  aria-busy={busy === mix.id || undefined}
                  disabled={busy === mix.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void open(mix, true);
                  }}
                >
                  {busy === mix.id ? (
                    <LoaderCircle
                      size={20}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <Play size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <span className="mt-px truncate text-[13px] text-ink-subtle">
              {failed === mix.id ? t("music.action.error") : mix.artists.join(", ")}
            </span>
          </div>
        ))}
      </Row>
    </section>
  );
}

export function madeForYouBand(ctx: MusicBandContext): MusicBand | null {
  return {
    key: "madeForYou",
    title: ctx.t("music.madeForYou.title"),
    catalog: false,
    render: (title) => <MadeForYouRow player={ctx.player} openMix={ctx.openMix} t={ctx.t} title={title} />,
  };
}
