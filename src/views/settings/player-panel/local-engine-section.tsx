import {
  Activity,
  AlertTriangle,
  Check,
  Download,
  Eraser,
  Gauge,
  Loader2,
  Play,
  RotateCw,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  torrentEngineHardReset,
  torrentEngineRestart,
  torrentEngineSelfTest as engineSelfTest,
  torrentEngineStatus as engineStatus,
  type EngineStatus,
} from "@/lib/torrent/local-engine";
import { Section, ToggleRow } from "../shared";
import {
  ROW_ACTION,
  ROW_ACTION_DANGER,
  ROW_ACTION_PRIMARY,
  ROW_DESC,
  SettingGroup,
  SettingRow,
} from "../kit";
import { BADGE_BASE } from "./choice";

type SelfTestResult = Awaited<ReturnType<typeof engineSelfTest>>;

type EngineState = "running" | "stopped" | "error";

const PILL: Record<EngineState, { dot: string; chip: string }> = {
  running: { dot: "bg-success", chip: "bg-elevated text-success" },
  stopped: { dot: "bg-ink-subtle", chip: "bg-elevated text-ink-subtle" },
  error: { dot: "bg-danger", chip: "bg-elevated text-danger" },
};

function engineState(status: EngineStatus | null): EngineState {
  if (status?.last_error) return "error";
  if (status?.ready) return "running";
  return "stopped";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 text-[15.5px] leading-[22px] text-ink-muted">
      {label}
      <span className={`font-mono tabular-nums ${tone ?? "text-accent"}`}>{value}</span>
    </span>
  );
}

export function LocalEngineSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const strictRemote = !!settings.remoteStreamServerUrl && settings.remoteStreamServerStrict;
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<SelfTestResult | null>(null);
  const busy = running || restarting || clearing;

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const next = await engineStatus();
      if (alive) setStatus(next);
    };
    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const runTest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await Promise.race([
        engineSelfTest(),
        new Promise<SelfTestResult>((res) => window.setTimeout(() => res(null), 75000)),
      ]);
      setResult(
        r ?? {
          pass: false,
          steps: [{ label: "self-test", ok: false, detail: "timed out, hit Restart engine" }],
        },
      );
    } finally {
      setRunning(false);
    }
  };

  const restart = async () => {
    setRestarting(true);
    setResult(null);
    try {
      const s = await torrentEngineRestart();
      if (s) setStatus(s);
    } finally {
      setRestarting(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    setResult(null);
    try {
      const s = await torrentEngineHardReset();
      if (s) setStatus(s);
    } finally {
      setClearing(false);
    }
  };

  const state = engineState(status);
  const pill = PILL[state];
  const pillLabel = state === "running" ? t("Running") : state === "error" ? t("Error") : t("Stopped");
  const udpStep = result?.steps.find((s) => s.label === "udp egress");
  const httpsStep = result?.steps.find((s) => s.label === "https egress");
  const udpBlocked = !!udpStep && !udpStep.ok && !!httpsStep && httpsStep.ok;
  const dhtNodes = status?.dht_nodes ?? 0;

  return (
    <Section
      title={t("Local engine")}
      subtitle={t("Built-in peer-to-peer streaming, served from your own machine.")}
    >
      <SettingGroup label={t("Status")}>
        <SettingRow
          wide
          icon={<Activity size={18} strokeWidth={1.9} />}
          label={t("Engine status")}
          desc={t("Live state of Harbor's own torrent engine on this machine.")}
          tip={t(
            "The engine listens on a local port and joins the DHT to find peers. Active torrents are the streams it currently has open.",
          )}
        >
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              <span className={`${BADGE_BASE} gap-1.5 ${pill.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                {pillLabel}
              </span>
              <Stat label={t("Port")} value={status?.port ? String(status.port) : t("n/a")} />
              <Stat label={t("Active torrents")} value={String(status?.active_torrents ?? 0)} />
              {status?.dht_tier ? (
                <Stat
                  label={t("DHT")}
                  value={`${dhtNodes} ${t("nodes")}`}
                  tone={dhtNodes > 0 ? "text-accent" : "text-danger"}
                />
              ) : null}
            </div>
            {status?.last_error && (
              <div className="flex w-full flex-col gap-1.5 rounded-[10px] bg-elevated px-4 py-3">
                <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-danger">
                  {status.last_error}
                </span>
                <span className={`max-w-[66ch] ${ROW_DESC}`}>
                  {t(
                    "If streams stop loading, hit Clear & restart below to wipe the engine and start it fresh on a new port.",
                  )}
                </span>
              </div>
            )}
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label={t("Behaviour")}>
        <ToggleRow
          label={t("Show P2P status chip")}
          sub={t(
            "Peers, speed and progress on the player while a torrent streams. Sits top left, clear of the exit button.",
          )}
          leading={<Gauge size={18} strokeWidth={2.2} />}
          value={settings.playerP2pChip}
          onChange={(v) => update({ playerP2pChip: v })}
        />

        <ToggleRow
          label={t("Keep downloading after you leave")}
          sub={t(
            "When off, a torrent stops the moment you close or switch the stream, so nothing keeps downloading in the background. Turn on to let it keep going after you leave; manage or pause those from the Downloads tab.",
          )}
          leading={<Download size={18} strokeWidth={2.2} />}
          value={settings.keepStreamDownloadsInBackground}
          onChange={(v) => update({ keepStreamDownloadsInBackground: v })}
        />

        <ToggleRow
          label={t("Only start the torrent engine when needed")}
          sub={t(
            "Harbor normally starts its torrent engine at launch so the first P2P stream connects faster. That keeps a DHT node running and talking to the network even when you are not watching anything. Turn this on if you are on a metered or limited connection: the engine then starts the first time you actually play a torrent. Takes effect next launch.",
          )}
          leading={<Timer size={18} strokeWidth={2.2} />}
          value={settings.deferTorrentEngine}
          onChange={(v) => update({ deferTorrentEngine: v })}
        />
      </SettingGroup>

      <SettingGroup label={t("Maintenance")}>
        <SettingRow
          label={t("Run self-test")}
          desc={t("Checks that this network can reach trackers and peers.")}
          tip={t(
            "Fetches a small public test torrent, then reports UDP and HTTPS egress, DHT bootstrap and tracker reachability step by step.",
          )}
          lockReason={
            strictRemote
              ? t(
                  "Self-test is disabled while strict remote streaming is on. It downloads a test torrent over peer-to-peer on this machine.",
                )
              : undefined
          }
        >
          <button
            type="button"
            onClick={busy || strictRemote ? undefined : () => void runTest()}
            aria-disabled={busy || strictRemote}
            className={`${ROW_ACTION_PRIMARY}${
              busy || strictRemote ? " pointer-events-none opacity-40" : ""
            }`}
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} strokeWidth={2.4} />}
            {running ? t("Running self-test") : t("Run self-test")}
          </button>
        </SettingRow>

        <SettingRow
          label={t("Restart engine")}
          desc={t("Stops and starts the engine. Cached stream files are kept.")}
        >
          <button
            type="button"
            onClick={busy ? undefined : () => void restart()}
            aria-disabled={busy}
            className={`${ROW_ACTION}${busy ? " pointer-events-none opacity-45" : ""}`}
          >
            {restarting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RotateCw size={16} strokeWidth={2.4} />
            )}
            {restarting ? t("Restarting") : t("Restart engine")}
          </button>
        </SettingRow>

        <SettingRow
          label={t("Clear & restart")}
          desc={t("Wipes engine data and starts fresh on a new port.")}
          warn={t("Cached stream files and the DHT cache are deleted. The next stream starts from scratch.")}
          tip={t(
            "The stronger fix when streams refuse to load. Cached stream files and the DHT cache are removed, so the next stream starts from scratch.",
          )}
        >
          <button
            type="button"
            onClick={busy ? undefined : () => void clearAll()}
            aria-disabled={busy}
            className={`${ROW_ACTION_DANGER}${busy ? " pointer-events-none opacity-45" : ""}`}
          >
            {clearing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Eraser size={16} strokeWidth={2.4} />
            )}
            {clearing ? t("Clearing") : t("Clear & restart")}
          </button>
        </SettingRow>

        {result && (
          <div className="flex flex-col gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="harbor-settings-label">{t("Self-test")}</h3>
              <span
                className={`${BADGE_BASE} gap-1.5 ${
                  result.pass ? "bg-canvas text-success" : "bg-canvas text-danger"
                }`}
              >
                {result.pass ? <Check size={14} strokeWidth={2.8} /> : <X size={14} strokeWidth={2.8} />}
                {result.pass ? t("Pass") : t("Fail")}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {result.steps.map((step) => (
                <li
                  key={step.label}
                  className="flex flex-wrap items-center gap-2.5 text-[15.5px] leading-[22px]"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center ${
                      step.ok ? "text-success" : step.warn ? "text-accent" : "text-danger"
                    }`}
                  >
                    {step.ok ? (
                      <Check size={16} strokeWidth={2.8} />
                    ) : step.warn ? (
                      <AlertTriangle size={15} strokeWidth={2.6} />
                    ) : (
                      <X size={16} strokeWidth={2.8} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-ink">{step.label}</span>
                  {step.detail && (
                    <span className="min-w-0 break-all text-end font-mono text-[15.5px] text-ink-subtle">
                      {step.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {udpBlocked && (
              <span className="flex items-start gap-2.5">
                <AlertTriangle size={18} strokeWidth={2.4} className="mt-[2px] shrink-0 text-accent" />
                <span className={`max-w-[66ch] ${ROW_DESC}`}>
                  {t(
                    "Your network blocks UDP, so DHT is offline, but HTTPS trackers are reachable over TCP. Streams can still find peers, they may just take a little longer to start.",
                  )}
                </span>
              </span>
            )}
          </div>
        )}
      </SettingGroup>
    </Section>
  );
}
