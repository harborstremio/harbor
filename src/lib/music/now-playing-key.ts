export type MusicNowPlaying = {
  id: string | null;
  connectorId: string | null;
  originId: string | null;
  originConnectorId: string | null;
  phase: string;
};

/** Newline, because a local track's id is a file path and may contain spaces. */
const SEP = "\n";

type NowPlayingTrack = {
  id: string;
  connectorId?: string | null;
  collectionOrigin?: { id: string; connectorId?: string } | null;
};

/**
 * The music store publishes on every time-pos tick, so useMusicPlayer re-renders its owner
 * about ten times a second. A track list is the worst place for that: a 200 row playlist
 * would re-render every row on every tick, which is the pressure that starved LazyMount and
 * left rows blank. Only identity and phase matter to a row, and both change rarely, so the
 * store is collapsed to one short string and React bails out on every tick that did not
 * change it. Kept free of any player import so it stays testable on its own.
 *
 * The origin identity rides along because a row is played by resolving it to whichever source
 * can serve it, so the track that ends up playing rarely carries the id the row was drawn from.
 */
export function buildNowPlayingKey(
  current: NowPlayingTrack | null | undefined,
  phase: string,
): string {
  const origin = current?.collectionOrigin;
  return [
    current?.connectorId ?? "",
    current?.id ?? "",
    origin?.connectorId ?? "",
    origin?.id ?? "",
    phase,
  ].join(SEP);
}

export function parseNowPlayingKey(value: string): MusicNowPlaying {
  const parts = value.split(SEP);
  if (parts.length < 5) {
    return { id: null, connectorId: null, originId: null, originConnectorId: null, phase: "idle" };
  }
  const [connectorId, id, originConnectorId, originId, phase] = parts;
  return {
    id: id || null,
    connectorId: connectorId || null,
    originId: originId || null,
    originConnectorId: originConnectorId || null,
    phase: phase || "idle",
  };
}

export function nowPlayingMatches(
  now: MusicNowPlaying,
  track: NowPlayingTrack | null | undefined,
): boolean {
  if (!track) return false;
  const matches = (id: string, connectorId?: string | null) => {
    const connector = connectorId ?? null;
    return (!!now.id && now.id === id && now.connectorId === connector)
      || (!!now.originId && now.originId === id && now.originConnectorId === connector);
  };
  if (matches(track.id, track.connectorId)) return true;
  // Saved rows can already be resolved uploads. Compare their original recording too,
  // so resolving the same song to a new source does not lose its playing indicator.
  const origin = track.collectionOrigin;
  return !!origin && matches(origin.id, origin.connectorId);
}
