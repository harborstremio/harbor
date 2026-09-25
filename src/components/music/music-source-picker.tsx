import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, ExternalLink, LoaderCircle, Music2, Unplug, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { MusicSourceRow } from "@/components/music/music-source-row";
import { useT } from "@/lib/i18n";
import { clearMusicError, getMusicState, playMusic } from "@/lib/music/player";
import { getMusicSourceCandidates, getSpotifyStatus } from "@/lib/music/sources";
import { useMusicConnections } from "./music-connections";
import { musicProviderSearch, musicRecoveryKey, musicSourceName } from "@/lib/music/recovery";
import { openUrl } from "@/lib/window";
import type { MusicSourceCandidate, MusicTrack, SpotifyStatus } from "@/lib/music/types";
import { readMusicPreference, writeMusicPreference } from "@/lib/music/preferences";
import { MusicServiceLogo } from "./music-service-logo";
import { pushBackHandler } from "@/lib/back-intercept";
import { requestMusicExplore } from "@/lib/music/navigation";
import { MusicSourcePopover } from "./music-source-popover";
import { MusicSourcePossible } from "./music-source-possible";

const SOURCE_KEY = "harbor.music.preferred-source.v1";
function fromCollection(selected: MusicTrack, original: MusicTrack): MusicTrack {
  return {
    ...selected,
    collectionOrigin: original.collectionOrigin ?? {
      id: original.id,
      connectorId: original.connectorId,
    },
  };
}
type PlaybackReady = (track: MusicTrack, queue: MusicTrack[]) => void;

type PickerRequest = {
  track: MusicTrack;
  queue: MusicTrack[];
  onReady?: PlaybackReady;
  forceChoice?: boolean;
  failure?: string;
  failedTrack?: MusicTrack;
};

let recoveryRequest: PickerRequest | null = null;
const RECOVER_EVENT = "harbor:music-choose-source";
export function chooseAnotherMusicSource(track: MusicTrack, queue: MusicTrack[]) {
  recoveryRequest = {
    track,
    queue,
    forceChoice: true,
    failure: getMusicState().error ?? undefined,
    failedTrack: track,
  };
  clearMusicError();
  window.dispatchEvent(new Event(RECOVER_EVENT));
}

type MusicSourcePickerContextValue = {
  openSourcePicker: (track: MusicTrack, queue?: MusicTrack[], onReady?: PlaybackReady) => void;
};

const MusicSourcePickerContext = createContext<MusicSourcePickerContextValue | null>(null);

export function MusicSourcePickerProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { openConnections } = useMusicConnections();
  const [request, setRequest] = useState<PickerRequest | null>(null);
  const [resolving, setResolving] = useState<MusicTrack | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const dismiss = useCallback(() => {
    generation.current += 1;
    setRequest(null);
    setResolving(null);
  }, []);
  const openSourcePicker = useCallback(
    (track: MusicTrack, queue = [track], onReady?: PlaybackReady, forceChoice = false) => {
      const current = ++generation.current;
      if (track.mediaKind === "video" && !onReady && !forceChoice) {
        setRequest(null);
        setResolving(null);
        requestMusicExplore({
          kind: "watch",
          track,
          queue: queue.filter((item) => item.mediaKind === "video"),
        });
        return;
      }
      const ready: PlaybackReady = (selected, selectedQueue) => {
        if (generation.current === current) onReady?.(selected, selectedQueue);
      };
      const preferred = readMusicPreference(SOURCE_KEY);
      if (track.playbackUrl && !forceChoice) {
        setRequest(null);
        void playMusic(track, queue)
          .then(() => ready(track, queue))
          .catch(() => {});
        return;
      }
      if (preferred && !forceChoice) {
        setRequest(null);
        setResolving(track);
        void getMusicSourceCandidates(track)
          .then(async (candidates) => {
            if (generation.current !== current) return;
            const match = candidates.find(
              (candidate) => candidate.connectorId === preferred && candidate.health !== "offline",
            );
            if (!match) {
              setRequest({ track, queue, onReady: ready });
              return;
            }
            const selected = fromCollection(match.track, track);
            const selectedQueue = queue.map((item) =>
              item.id === track.id && item.connectorId === track.connectorId ? selected : item,
            );
            await playMusic(selected, selectedQueue);
            ready(selected, selectedQueue);
          })
          .catch((reason) => {
            if (generation.current === current) {
              setRequest({
                track,
                queue,
                onReady: ready,
                forceChoice: true,
                failure: String(reason),
                failedTrack: getMusicState().current ?? track,
              });
              clearMusicError();
            }
          })
          .finally(() => {
            if (generation.current === current) setResolving(null);
          });
        return;
      }
      setResolving(null);
      setRequest({ track, queue, onReady: ready, forceChoice });
    },
    [],
  );
  useEffect(() => {
    const recover = () => {
      if (!recoveryRequest) return;
      const next = recoveryRequest;
      recoveryRequest = null;
      generation.current += 1;
      setResolving(null);
      setRequest(next);
    };
    recover();
    window.addEventListener(RECOVER_EVENT, recover);
    return () => window.removeEventListener(RECOVER_EVENT, recover);
  }, [openSourcePicker]);
  const value = useMemo(() => ({ openSourcePicker }), [openSourcePicker]);

  return (
    <MusicSourcePickerContext.Provider value={value}>
      {children}
      {resolving && (
        <div
          role="status"
          style={{
            bottom:
              "calc(6rem + var(--harbor-music-dock, 0px) + var(--harbor-viewport-bottom, 0px))",
          }}
          className="fixed bottom-24 end-6 z-[90] flex max-w-[calc(100vw-3rem)] items-center gap-3 rounded-lg bg-elevated p-4 text-ink"
        >
          <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
          <span className="min-w-0">
            <strong className="block truncate text-sm">{resolving.title}</strong>
            <small className="text-ink-muted">{t("music.source.loading")}</small>
          </span>
          <button type="button" onClick={dismiss} aria-label={t("common.cancel")} className="p-2">
            <X size={18} />
          </button>
        </div>
      )}
      {request && (
        <MusicSourcePicker
          key={request.track.id}
          request={request}
          onClose={dismiss}
          onStarting={() => setRequest(null)}
          onConnect={() => openConnections("spotify")}
        />
      )}
    </MusicSourcePickerContext.Provider>
  );
}

export function useMusicSourcePicker(): MusicSourcePickerContextValue {
  const value = useContext(MusicSourcePickerContext);
  if (!value) throw new Error("Music source picker must be used inside its provider");
  return value;
}

export function MusicSourcePicker({
  request,
  onClose,
  onStarting,
  onConnect,
  anchor,
}: {
  request: PickerRequest;
  onClose: () => void;
  onStarting: () => void;
  onConnect: () => void;
  anchor?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented) return;
      const dialog = closeButton.current?.closest('[role="dialog"]');
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal=true], [data-music-source-popover]',
      );
      if (!dialog || dialogs.item(dialogs.length - 1) !== dialog) return;
      const buttons = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), a[href], summary",
        ),
      ].filter((node) => node.getClientRects().length > 0);
      const first = buttons[0],
        last = buttons.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    };
  }, []);
  const { closing, close } = useModalExit(onClose);
  useEffect(
    () =>
      pushBackHandler(() => {
        close();
        return true;
      }),
    [close],
  );
  const [candidates, setCandidates] = useState<MusicSourceCandidate[]>([]);
  const [spotify, setSpotify] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const preferred = readMusicPreference(SOURCE_KEY);
  const failedTrack = request.failedTrack ?? request.track;
  const failedSource = request.failure ? failedTrack.connectorId : undefined;
  const providerLink = musicProviderSearch(failedTrack);

  const load = useCallback(() => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    void Promise.all([
      getMusicSourceCandidates(request.track),
      getSpotifyStatus().catch(() => null),
    ])
      .then(([nextCandidates, status]) => {
        if (loadGeneration.current !== generation) return;
        setCandidates(nextCandidates);
        setSpotify(status);
      })
      .catch((reason) => {
        if (loadGeneration.current === generation) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (loadGeneration.current === generation) setLoading(false);
      });
  }, [request.track]);

  useEffect(() => {
    load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [load]);

  const ordered = useMemo(() => {
    const [original, ...alternatives] = candidates;
    alternatives.sort((left, right) => {
      if (left.connectorId === preferred) return -1;
      if (right.connectorId === preferred) return 1;
      return sourcePriority(left.connectorId) - sourcePriority(right.connectorId);
    });
    return (original ? [original, ...alternatives] : alternatives).sort(
      (left, right) =>
        Number(left.connectorId === failedSource) - Number(right.connectorId === failedSource),
    );
  }, [candidates, preferred, failedSource]);

  const start = (chosen: MusicTrack, connectorId?: string) => {
    setError(null);
    if (connectorId) {
      setPending(connectorId);
      writeMusicPreference(SOURCE_KEY, connectorId);
    }
    const selected = fromCollection(chosen, request.track);
    const queue = request.queue.map((track) =>
      track.id === request.track.id && track.connectorId === request.track.connectorId
        ? selected
        : track,
    );
    onStarting();
    void playMusic(selected, queue)
      .then(() => {
        request.onReady?.(selected, queue);
      })
      .catch(() => {
        /* The persistent player exposes retry and other sources. */
      });
  };

  const select = (candidate: MusicSourceCandidate) =>
    start(candidate.track, candidate.connectorId);

  const connect = () => {
    onClose();
    onConnect();
  };

  const content = (
    <>
      <header className="flex items-start gap-4 border-b border-edge-soft p-5">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-elevated text-ink-muted">
          {request.track.artwork ? (
            <img src={request.track.artwork} alt="" className="size-full object-cover" />
          ) : (
            <Music2 size={20} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-subtle">
            {t("music.source.playOn")}
          </p>
          <h2 id="music-source-title" className="mt-1 truncate font-semibold text-2xl text-ink">
            {request.track.title}
          </h2>
          <p className="mt-1 truncate text-xs text-ink-muted">{request.track.artist}</p>
        </div>
        <button
          ref={closeButton}
          type="button"
          onClick={close}
          className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-elevated hover:text-ink"
          aria-label={t("common.close")}
        >
          <X size={17} />
        </button>
      </header>

      <div className="flex min-h-40 flex-col overflow-y-auto px-2 pb-2">
        {request.failure && (
          <section
            className="m-2 rounded-md bg-elevated p-4"
            aria-label={t("music.recovery.title")}
          >
            <h3 className="text-sm font-semibold text-ink">
              {t("music.recovery.failed", { source: musicSourceName(failedTrack) })}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t(musicRecoveryKey(request.failure, failedTrack), {
                source: musicSourceName(failedTrack),
              })}
            </p>
            {providerLink && (
              <button
                type="button"
                onClick={() => openUrl(providerLink)}
                className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs text-ink underline-offset-4 hover:underline"
              >
                {t("music.recovery.open", { source: musicSourceName(failedTrack) })}
                <ExternalLink size={13} />
              </button>
            )}
          </section>
        )}
        {!spotify?.connected && (
          <button
            type="button"
            onClick={connect}
            className="order-last my-2 grid min-h-20 w-full shrink-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-edge-soft px-4 text-start hover:bg-elevated/55 disabled:opacity-50"
          >
            <span className="grid size-10 place-items-center rounded-md bg-raised text-ink-muted">
              <MusicServiceLogo source="spotify" fallback={<Unplug size={16} />} />
            </span>
            <span>
              <strong className="block text-[13px] text-ink">{t("music.spotify.connect")}</strong>
              <small className="mt-1 block text-[10px] text-ink-muted">
                {t("music.recovery.spotifySetup")}
              </small>
            </span>
            <span className="rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-canvas">
              {t("music.recovery.setupAction")}
            </span>
          </button>
        )}

        {spotify?.connected && (
          <div className="mx-2 flex items-center justify-between border-b border-edge-soft py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-subtle">
            <span className="inline-flex items-center gap-2">
              <Check size={12} />{" "}
              {t("music.spotify.connectedAs", { username: spotify.username ?? "Spotify" })}
            </span>
            <span>{t("music.spotify.premium")}</span>
          </div>
        )}

        {loading ? (
          <div className="grid gap-px py-2" aria-label={t("music.source.loading")}>
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-md bg-elevated/45" />
            ))}
          </div>
        ) : (
          ordered.map((candidate) => (
            <MusicSourceRow
              key={`${candidate.connectorId}:${candidate.track.sourceId ?? candidate.track.id}`}
              candidate={candidate}
              preferred={
                candidate.connectorId === preferred && candidate.connectorId !== failedSource
              }
              failed={candidate.connectorId === failedSource}
              pending={pending === candidate.connectorId}
              onSelect={() => select(candidate)}
            />
          ))
        )}

        {!loading && ordered.length === 0 && !error && (
          <div className="grid min-h-28 place-items-center px-6 text-center text-xs text-ink-muted">
            {t("music.source.none")}
          </div>
        )}
        {!loading && !error && (
          <MusicSourcePossible
            track={request.track}
            covered={candidates.map((candidate) => candidate.connectorId).join(",")}
            onPick={(found) => start(found, found.connectorId)}
          />
        )}
        {error && (
          <div className="m-2 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
            <p>{t("music.recovery.search")}</p>
            <button
              type="button"
              className="mt-2 min-h-9 text-ink underline underline-offset-4"
              onClick={load}
            >
              {t("common.retry")}
            </button>
          </div>
        )}
      </div>
    </>
  );
  return anchor ? (
    <MusicSourcePopover anchor={anchor} closing={closing} onDismiss={close}>
      {content}
    </MusicSourcePopover>
  ) : (
    <ModalShell
      closing={closing}
      onDismiss={close}
      width={560}
      backdropClassName="music-source-modal"
      labelledBy="music-source-title"
    >
      {content}
    </ModalShell>
  );
}

function sourcePriority(id: string): number {
  const priority: Record<string, number> = { spotify: 0, soundcloud: 1, youtube: 2 };
  return priority[id] ?? 3;
}
