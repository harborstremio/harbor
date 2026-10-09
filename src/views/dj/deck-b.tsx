import { useCallback, useEffect, useRef, useState } from "react";
import { Disc3, Pause, Play, Square } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  broadcastStatus,
  deckPause,
  deckPlay,
  deckSnapshot,
  deckStop,
  getCrossfade,
  setCrossfade,
  setPrimaryDeck,
  type MusicDeckState,
} from "@/lib/music/decks";
import { sendDeckCommand, subscribeDeckAdopted } from "@/lib/music/deck-sync";
import { getMusicState, musicSourceCandidates } from "@/lib/music/player";
import type { MusicTrack } from "@/lib/music/types";
import { Hardware } from "./controls";
import { clock } from "./deck-state";

const POLL_MS = 900;
const TAKEOVER = 0.35;
const HEARTBEAT = 8;

let cued: MusicTrack | null = null;
let ticket = 0;

export function DeckB({ next }: { next: MusicTrack | undefined }) {
  const t = useT();
  const [state, setState] = useState<MusicDeckState | null>(null);
  const [fade, setFade] = useState(-1);
  const [broadcasting, setBroadcasting] = useState(false);
  const [loaded, setLoaded] = useState<MusicTrack | null>(cued);
  const [failed, setFailed] = useState<string | null>(null);
  const [primary, setPrimary] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const dragging = useRef(false);
  const fadeRef = useRef(-1);
  const freeRef = useRef(1);
  const [freeDeck, setFreeDeck] = useState(1);
  const live = useRef(true);
  const cueing = useRef(false);
  const landed = useRef({ key: "", deck: -1 });
  const pending = useRef<{ nonce: number; key: string } | null>(null);
  const beats = useRef(HEARTBEAT);

  useEffect(() => {
    fadeRef.current = fade;
  }, [fade]);

  useEffect(() => {
    void getCrossfade().then((value) => {
      if (!dragging.current) setFade(value);
    });
  }, []);

  useEffect(
    () =>
      subscribeDeckAdopted((ack) => {
        const asked = pending.current;
        if (!asked || ack.nonce !== asked.nonce) return;
        pending.current = null;
        if (!ack.landed) return;
        landed.current = { key: asked.key, deck: ack.deck };
        setConfirmed(ack.deck === 1);
      }),
    [],
  );

  const sync = useCallback(async () => {
    const snapshot = await deckSnapshot();
    const status = await broadcastStatus();
    if (!live.current) return;
    const slot = snapshot.primary === 1 ? 0 : 1;
    freeRef.current = slot;
    setFreeDeck(slot);
    const deck = snapshot.decks[slot];
    setState(deck);
    const onAirDeck = snapshot.decks[snapshot.primary];
    if (!deck.live && !dragging.current && onAirDeck?.live) {
      const home = snapshot.primary === 1 ? 1 : -1;
      if (fadeRef.current !== home) {
        fadeRef.current = home;
        setFade(home);
        void setCrossfade(home).catch(() => {});
      }
    }
    setBroadcasting(status.active);
    setPrimary(snapshot.primary);
    const holds = !cued || !deck.trackId || cued.id === deck.trackId;
    if (!cueing.current && (!deck.live || !holds)) {
      cued = null;
      setLoaded(null);
    }
    if (deck.live && cued) setLoaded((shown) => shown ?? cued);
    const air = snapshot.decks[snapshot.primary];
    const key = `${snapshot.primary}:${air?.trackId ?? ""}`;
    const settled = landed.current.key === key;
    setConfirmed(snapshot.primary === 1 && landed.current.deck === 1);
    if (settled && beats.current < HEARTBEAT) {
      beats.current += 1;
      return;
    }
    beats.current = 0;
    ticket += 1;
    pending.current = { nonce: ticket, key };
    sendDeckCommand({
      kind: "adopt",
      nonce: ticket,
      deck: snapshot.primary,
      track: cued && cued.id === air?.trackId ? cued : null,
      trackId: air?.trackId ?? null,
      connectorId: air?.connectorId ?? null,
      live: air?.live ?? false,
      paused: air?.paused ?? true,
      position: air?.positionSeconds ?? null,
      duration: air?.durationSeconds ?? null,
    });
  }, []);

  useEffect(() => {
    live.current = true;
    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      live.current = false;
      window.clearInterval(timer);
    };
  }, [sync]);

  const slide = useCallback(
    (value: number) => {
      dragging.current = true;
      setFade(value);
      void setCrossfade(value)
        .then(() => sync())
        .catch(() => {});
    },
    [sync],
  );

  const load = useCallback(async () => {
    if (!next) return;
    cued = next;
    setLoaded(next);
    cueing.current = true;
    setFailed(null);
    const cue = async (track: MusicTrack) => {
      await deckPlay(freeRef.current, track, getMusicState().volume);
      cued = track;
      setLoaded(track);
      await deckPause(freeRef.current, true).catch(() => {});
      const atFree = freeRef.current === 1 ? fade >= TAKEOVER : fade <= -TAKEOVER;
      if (atFree) await setPrimaryDeck(freeRef.current).catch(() => false);
      await sync();
    };
    try {
      await cue(next);
      cueing.current = false;
      return;
    } catch {
      setFailed(t("dj.b.searching"));
    }
    const candidates = await musicSourceCandidates(next);
    let tried = 0;
    for (const candidate of candidates) {
      if (candidate.health === "offline" || candidate.track.connectorId === "catalog") continue;
      if (tried >= 3) break;
      tried += 1;
      try {
        await cue({
          ...candidate.track,
          title: next.title,
          artist: next.artist,
          artwork: next.artwork ?? candidate.track.artwork,
          collectionOrigin: next.collectionOrigin ?? { id: next.id, connectorId: next.connectorId },
        });
        cueing.current = false;
        setFailed(null);
        return;
      } catch {
        continue;
      }
    }
    cueing.current = false;
    cued = null;
    setLoaded(null);
    setFailed(t("dj.b.noSource"));
  }, [fade, next, sync, t]);

  const isLive = state?.live ?? false;
  const onAir = false;
  const playing = isLive && !(state?.paused ?? true);
  const title = loaded?.title ?? (isLive ? t("dj.b.loaded") : t("dj.b.empty"));
  const blend = Math.round(((fade + 1) / 2) * 100);
  const elapsed = `${clock(state?.positionSeconds ?? 0)} / ${clock(state?.durationSeconds ?? 0)}`;

  return (
    <div className="dj-bay dj-deckb">
      <div className="dj-bay-head">
        <span>{t(freeDeck === 1 ? "dj.b.title" : "dj.a.title")}</span>
        <span className="dj-bay-note" data-bad={failed ? "" : undefined}>
          {failed
            ? failed
            : broadcasting
              ? t("dj.b.broadcasting")
              : isLive && primary === 1 && confirmed
                ? `${t("dj.b.onAir")} ${elapsed}`
                : isLive && fade <= -0.98
                  ? t("dj.b.silent")
                  : isLive
                    ? elapsed
                    : t("dj.b.hint")}
        </span>
      </div>
      <div className="dj-bay-row">
        <span className="dj-deckb-track">{title}</span>
        <Hardware
          tone="cyan"
          label={t("dj.b.load")}
          disabled={!next || broadcasting || onAir}
          onClick={() => void load()}
        />
        <Hardware
          tone="green"
          lit={playing}
          disabled={!isLive || broadcasting}
          label={t(playing ? "dj.pause" : "dj.play")}
          onClick={() => void deckPause(freeRef.current, playing).catch(() => {})}
        >
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </Hardware>
        <Hardware
          tone="red"
          label={t("dj.b.eject")}
          disabled={!isLive || broadcasting}
          onClick={() => void deckStop(freeRef.current).catch(() => {})}
        >
          <Square size={13} fill="currentColor" />
        </Hardware>
      </div>
      <div className="dj-deckb-slot" data-empty={loaded ? undefined : ""}>
        {loaded?.artwork ? (
          <img src={loaded.artwork} alt="" draggable={false} />
        ) : (
          <span className="dj-deckb-blank" aria-hidden="true">
            <Disc3 size={22} />
          </span>
        )}
        <span className="dj-deckb-meta">
          <strong>{title}</strong>
          <small>
            {loaded ? loaded.artist : next && !onAir ? `${t("dj.b.load")}: ${next.title}` : ""}
          </small>
        </span>
      </div>

      <label className="dj-crossfade">
        <span className="dj-crossfade-head">
          <b>A</b>
          <span>{`${t("dj.crossfade")} ${blend}%`}</span>
          <b>B</b>
        </span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={fade}
          aria-label={t("dj.crossfade")}
          onChange={(event) => slide(Number(event.target.value))}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onDoubleClick={() => slide(-1)}
        />
      </label>
    </div>
  );
}
