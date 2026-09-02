import { ListPlus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "@/lib/build-info";
import { useT } from "@/lib/i18n";
import { queueAdd } from "@/lib/queue";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import {
  HarborDeviceCard,
  ListeningPulse,
  TrustAction,
  lanTrustOf,
  useDeviceRoster,
  usePairedIds,
  type CardStatus,
} from "./play-on-device-card";
import {
  advertiseHarbor,
  describeInstance,
  deviceStateOf,
  harborIdentity,
  isTauri,
  platformLabel,
  probeInstance,
  stopAdvertisingHarbor,
  sweepHarborInstances,
  themeLabel,
  type HarborIdentity,
  type HarborInstance,
  type HarborReach,
  type SweepHandle,
} from "./play-on-lan";
import { PlayOnPairHost, openPairFlow, usePairFlowTarget } from "./play-on-pair";
import { PlayOnReceiver } from "./play-on-receiver";
import { failureText, needsPairing, sendToInstance, type PlayOnAction } from "./play-on-send";
import { closePlayOn, usePlayOnRequest, type PlayOnRequest } from "./play-on-trigger";

export function PlayOnModal() {
  const request = usePlayOnRequest();
  const { settings } = useSettings();
  const commandable = settings.serveWebUi || settings.remoteControlEnabled;
  const themeId = settings.theme.preset;

  useEffect(() => {
    if (!isTauri) return;
    void advertiseHarbor({ commandable, theme: themeId });
  }, [commandable, themeId]);

  useEffect(() => {
    if (!isTauri) return;
    return () => {
      void stopAdvertisingHarbor();
    };
  }, []);

  return (
    <>
      <PlayOnReceiver />
      {request ? <PlayOnPanel request={request} themeId={themeId} /> : null}
      <PlayOnPairHost />
    </>
  );
}

function QueueButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-11 shrink-0 items-center justify-center self-center rounded-xl text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
    >
      <ListPlus size={17} strokeWidth={2} />
    </button>
  );
}

function PlayOnPanel({ request, themeId }: { request: PlayOnRequest; themeId: string }) {
  const t = useT();
  const { openPicker } = useView();
  const [identity, setIdentity] = useState<HarborIdentity | null>(null);
  const [peers, setPeers] = useState<HarborInstance[]>([]);
  const [settled, setSettled] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [reach, setReach] = useState<Record<string, HarborReach>>({});
  const [rows, setRows] = useState<Record<string, CardStatus>>({});
  const alive = useRef(true);
  const probed = useRef(new Set<string>());
  const sweep = useRef<SweepHandle | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pairing = usePairFlowTarget();
  const pairingUp = useRef(false);

  const scan = useCallback(() => {
    sweep.current?.cancel();
    probed.current.clear();
    setReach({});
    setSettled(false);
    setScanning(true);
    sweep.current = sweepHarborInstances((found, done) => {
      if (!alive.current) return;
      setPeers(found);
      setSettled(done);
      if (done) setScanning(false);
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    void harborIdentity().then((id) => {
      if (alive.current) setIdentity(id);
    });
    scan();
    return () => {
      alive.current = false;
      sweep.current?.cancel();
    };
  }, [scan]);

  useEffect(() => {
    for (const peer of peers) {
      if (!peer.commandable || probed.current.has(peer.id)) continue;
      probed.current.add(peer.id);
      setReach((prev) => ({ ...prev, [peer.id]: "checking" }));
      void probeInstance(peer).then((ok) => {
        if (!alive.current) return;
        setReach((prev) => ({ ...prev, [peer.id]: ok ? "reachable" : "unreachable" }));
      });
    }
  }, [peers]);

  useEffect(() => {
    pairingUp.current = pairing !== null;
  }, [pairing]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pairingUp.current) closePlayOn();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const payload = useMemo(
    () => ({
      metaId: request.meta.id,
      metaType: request.meta.type,
      name: request.meta.name,
      poster: request.meta.poster,
      season: request.episode?.season,
      episode: request.episode?.episode,
      resume: true,
      fromInstance: identity?.id,
      fromName: identity?.name,
      theme: themeId,
    }),
    [request, identity, themeId],
  );

  const clearRow = useCallback((id: string) => {
    setRows((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const runRemote = useCallback(
    async (instance: HarborInstance, action: PlayOnAction) => {
      setRows((prev) => ({ ...prev, [instance.id]: { kind: "busy", text: t("Sending to that Harbor") } }));
      const result = await sendToInstance(instance, action, payload);
      if (!alive.current) return;
      if (result.ok) {
        setRows((prev) => ({ ...prev, [instance.id]: { kind: "done", text: t("On its way") } }));
        window.setTimeout(() => closePlayOn(), 620);
        return;
      }
      if (needsPairing(result.reason)) {
        clearRow(instance.id);
        openPairFlow(instance);
        return;
      }
      setRows((prev) => ({
        ...prev,
        [instance.id]: { kind: "failed", text: failureText(result.reason) },
      }));
    },
    [clearRow, payload, t],
  );

  const playHere = useCallback(() => {
    closePlayOn();
    openPicker(request.meta, request.episode, { autoPlay: true, resume: true });
  }, [openPicker, request]);

  const queueHere = useCallback(() => {
    queueAdd(request.meta, request.episode);
    closePlayOn();
  }, [request]);

  const roster = useDeviceRoster(peers, settled);
  const pairedIds = usePairedIds();

  const localName = identity?.name?.trim() || t("This computer");
  const localDetail = [
    platformLabel(identity?.platform ?? ""),
    `Harbor ${identity?.version || APP_VERSION}`,
    themeLabel(themeId),
  ]
    .filter(Boolean)
    .join(" / ");

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-canvas/75 p-6 backdrop-blur-[3px] animate-fade-in motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-label={t("Play on")}
      onMouseDown={closePlayOn}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[min(600px,calc(100vh-3rem))] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_28px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-edge-soft outline-none animate-popover-in motion-reduce:animate-none"
        style={{ transformOrigin: "center" }}
      >
        <header className="flex items-start gap-3 border-b border-edge-soft px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{t("Play on")}</h2>
            <p className="truncate text-[12.5px] text-ink-subtle">{request.meta.name}</p>
          </div>
          <button
            type="button"
            onClick={closePlayOn}
            aria-label={t("Close")}
            className="-me-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
          <HarborDeviceCard
            name={localName}
            platform={identity?.platform ?? ""}
            detail={localDetail}
            theme={themeId}
            state="self"
            onActivate={playHere}
            activateLabel={t("Play here")}
            actions={<QueueButton onClick={queueHere} disabled={false} label={t("Add to queue")} />}
          />

          {roster.map((entry) => {
            const peer = entry.instance;
            const label = peer.name?.trim() || t("Harbor");
            const paired = pairedIds.has(peer.id);
            const state = deviceStateOf(
              peer,
              lanTrustOf(peer.id, pairedIds),
              reach[peer.id] ?? "unknown",
            );
            const status = rows[peer.id];
            const blocked = state === "remote-off" || state === "unreachable";
            const locked = blocked || status?.kind === "busy" || status?.kind === "done";
            return (
              <HarborDeviceCard
                key={peer.id}
                name={label}
                platform={peer.platform}
                detail={describeInstance(peer)}
                theme={peer.theme}
                state={state}
                status={status}
                stagger={entry.stagger}
                leaving={entry.leaving}
                onActivate={() => void runRemote(peer, "playMeta")}
                activateLabel={t("Play now")}
                actions={
                  paired || blocked ? (
                    <QueueButton
                      onClick={() => void runRemote(peer, "queueMeta")}
                      disabled={locked}
                      label={t("Add to queue")}
                    />
                  ) : (
                    <TrustAction
                      label={t("Pair")}
                      hint={`${t("Pair")}: ${label}`}
                      loud
                      onClick={() => openPairFlow(peer)}
                    />
                  )
                }
              />
            );
          })}

          {settled && peers.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] leading-relaxed text-ink-muted">
              {isTauri
                ? t("No other Harbor answered on this network. One shows up here a moment after it starts.")
                : t("Network discovery needs the desktop app.")}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-edge-soft px-5 py-3">
          <span className="flex items-center gap-2 text-[11.5px] text-ink-subtle">
            <ListeningPulse active={scanning} />
            {scanning
              ? t("Listening for Harbors")
              : peers.length === 1
                ? t("1 other Harbor")
                : t("{n} other Harbors", { n: peers.length })}
          </span>
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="flex h-11 items-center gap-2 rounded-full px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            <RefreshCw size={13} strokeWidth={2.1} />
            {t("Rescan")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
