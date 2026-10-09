import { useEffect, useMemo, useRef, useState } from "react";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import { useBlockedArtistFilter } from "@/lib/music/artist-blocks";
import { useHiddenMusicRecents } from "@/lib/music/hidden-recents";
import { musicExploreSeeds, readListeningAffinity } from "@/lib/music/listening-affinity";
import { freshContinuationTracks } from "@/lib/music/queue-continuation";
import { musicTrackIdentity } from "@/lib/music/track-identity";
import { activeProfileId } from "@/lib/active-profile-id";
import { useT } from "@/lib/i18n";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { loadExploreRecommendations, type ExploreRecommendation } from "@/lib/music/explore-recommendations";
export function MusicExploreRecommendations({ active, onOpen }: { active: boolean; onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void }) {
  const t = useT(), player = useMusicPlayback(), profile = activeProfileId();
  const hidden = useHiddenMusicRecents();
  const recent = useBlockedArtistFilter(player.recents.filter(track => !hidden.includes(track.id)), "show");
  const liked = useBlockedArtistFilter(player.likedTracks, "show");
  const seeds = useMemo(() => musicExploreSeeds(recent, liked, readListeningAffinity(profile)), [recent, liked, profile]);
  const [chosen, setChosen] = useState<MusicTrack | null>(null);
  const seed = seeds.find(track => chosen && musicTrackIdentity(track) === musicTrackIdentity(chosen)) ?? seeds[0];
  const [visible, setVisible] = useState(false), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<(ExploreRecommendation & { key: string; error: boolean }) | null>(null);
  const root = useRef<HTMLElement>(null), history = useRef<MusicTrack[]>([]);
  history.current = [...player.recents, ...player.likedTracks, ...player.queue];
  const key = seed ? `${profile}:${musicTrackIdentity(seed)}` : "";
  useEffect(() => {
    const node = root.current; if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { rootMargin: "160px" });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!active || !visible || !seed) return;
    let live = true; setResult(null);
    loadExploreRecommendations([seed, ...seeds.filter(item => musicTrackIdentity(item) !== musicTrackIdentity(seed))], history.current)
      .then(value => { if (live) setResult({ key, ...value, error: false }); })
      .catch(() => { if (live) setResult({ key, seed: null, tracks: [], error: true }); });
    return () => { live = false; };
    // Track identity owns a request; playback ticks and provider enrichment do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, visible, retry]);
  const current = result?.key === key ? result : null;
  const fresh = current?.seed ? freshContinuationTracks(current.tracks, history.current) : current?.tracks ?? [];
  const shown = useBlockedArtistFilter(useBlockedArtistFilter(fresh, "show"), "play");
  const items: MusicCatalogItem[] = shown.slice(0,12).map(track => ({ ...track, kind: "track" }));
  return <section ref={root} className="flex min-w-0 flex-col gap-4">
    <MusicSectionHead title={t("music.explore.forYou")} subtitle={current?.seed ? t("music.explore.because", { title: current.seed.title, artist: current.seed.artist }) : current ? t("music.explore.chartSource") : seed ? t("music.explore.because", { title: seed.title, artist: seed.artist }) : t("music.explore.listenHint")}/>
    {!!seeds.length && <div className="music-explore-seeds">{seeds.map(track => <button type="button" key={musicTrackIdentity(track)} aria-pressed={musicTrackIdentity(track) === musicTrackIdentity(seed)} onClick={() => { setChosen(track); setRetry(0); }}>
      {track.artwork && <img src={track.artwork} alt="" loading="lazy"/>}<span>{track.artist}</span>
    </button>)}</div>}
    {seed && (current && !current.error && !items.length ? <p className="music-genre-empty">{t("music.explore.noRecommendations")}</p>
      : <MusicCatalogRow row={{ id: `explore:${key}`, title: "", titleLiteral: true, layout: "covers", source: "", items }} playable
      status={!current ? "loading" : current.error ? "error" : "ready"} onRetry={() => setRetry(value => value + 1)} onOpen={item => onOpen(item,items)}/>)}
  </section>;
}
