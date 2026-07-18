import { Check, Copy, ExternalLink, Loader2, Play, RotateCw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/lib/settings";
import { BUNDLED_SERVER_URL, getCastServerStatus, restartCastServer } from "@/lib/stremio-server";
import { openUrl } from "@/lib/window";
import { ToggleRow, settingsAnchor } from "../shared";
import { isTauri } from "./internals";
import { useT } from "@/lib/i18n";

const WEB_PORT = 11471;

type EngineState = "checking" | "running" | "starting" | "stopped";

const PILL: Record<EngineState, { label: string; dot: string; chip: string }> = {
  checking: { label: "Checking", dot: "bg-ink-subtle", chip: "bg-ink-subtle/15 text-ink-muted" },
  running: { label: "Running", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-400" },
  starting: { label: "Starting", dot: "bg-accent", chip: "bg-accent/15 text-accent" },
  stopped: { label: "Not running", dot: "bg-danger", chip: "bg-danger/15 text-danger" },
};

async function probeBundled(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${BUNDLED_SERVER_URL}/settings`, {
      method: "GET",
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function readEngineState(): Promise<EngineState> {
  const s = await getCastServerStatus();
  if (s?.ready) return "running";
  if (s?.running) return "starting";
  return (await probeBundled()) ? "running" : "stopped";
}

function AddressRow({ label, url, openable }: { label: string; url: string; openable?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="h-10 flex-1 truncate rounded-xl border border-edge-soft bg-canvas px-3.5 font-mono text-[13px] leading-10 text-ink">
          {url}
        </span>
        <button
          type="button"
          onClick={copy}
          className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-[12.5px] font-medium transition-colors ${
            copied
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-edge text-ink-muted hover:bg-elevated hover:text-ink"
          }`}
        >
          {copied ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={1.9} />}
          {copied ? t("Copied") : t("Copy")}
        </button>
        {openable && (
          <button
            type="button"
            onClick={() => openUrl(url)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-edge px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <ExternalLink size={13} strokeWidth={1.9} />
            {t("Open")}
          </button>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  busy,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-60"
    >
      {busy ? <Loader2 size={13} strokeWidth={1.9} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

export function ServerAddressSection() {
  const t = useT();
  const { settings, update } = useSettings();
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [engine, setEngine] = useState<EngineState>("checking");
  const [acting, setActing] = useState(false);
  const [webError, setWebError] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const refresh = async () => {
    const next = await readEngineState();
    const s = await getCastServerStatus();
    if (aliveRef.current) {
      setEngine(next);
      setLastError(next === "stopped" ? (s?.last_error ?? null) : null);
    }
  };

  useEffect(() => {
    if (!isTauri) return;
    aliveRef.current = true;
    void invoke<string | null>("lan_ip")
      .then((ip) => {
        if (aliveRef.current) setLanIp(ip);
      })
      .catch(() => {});
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isTauri || !(settings.serveWebUi || settings.remoteControlEnabled)) {
      setWebError(false);
      return;
    }
    const t = window.setTimeout(() => {
      void invoke<boolean>("web_serve_status")
        .then((ok) => {
          if (aliveRef.current) setWebError(!ok);
        })
        .catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [settings.serveWebUi, settings.remoteControlEnabled]);

  if (!isTauri) return null;

  const pill = PILL[engine];
  const running = engine === "running" || engine === "starting";

  const pillLabel =
    pill.label === "Checking"
      ? t("Checking")
      : pill.label === "Running"
        ? t("Running")
        : pill.label === "Starting"
          ? t("Starting")
          : t("Not running");

  const start = async () => {
    setActing(true);
    setEngine("starting");
    await restartCastServer();
    window.setTimeout(() => {
      void refresh().then(() => setActing(false));
    }, 1200);
  };

  const stop = async () => {
    setActing(true);
    await invoke("cast_server_stop").catch(() => {});
    window.setTimeout(() => {
      void refresh().then(() => setActing(false));
    }, 600);
  };

  return (
    <section
      id={settingsAnchor("Your streaming server address")}
      className="scroll-mt-28 flex flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[19px] font-medium tracking-tight text-ink">
            {t("Your streaming server address")}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {t(
              "Harbor runs a small streaming server right on this computer. This is where it lives. To stream from this machine on another device, copy the Wi-Fi address and paste it into Remote streaming server in Harbor over there.",
            )}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${pill.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {pillLabel}
        </span>
      </div>

      <AddressRow label={t("On this computer")} url={BUNDLED_SERVER_URL} openable={running} />
      {lanIp && (
        <AddressRow label={t("From other devices on your Wi-Fi")} url={`http://${lanIp}:11470`} />
      )}
      {engine === "stopped" && lastError && (
        <div className="rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger">
          <span className="font-semibold">{t("Server couldn't start:")}</span> {lastError}
          {/not bundled/i.test(lastError) && (
            <span className="mt-1.5 block text-ink-muted">
              {t(
                "This usually means antivirus removed the server file (stremio-server.exe). Add Harbor's install folder to your antivirus exclusions, then reinstall.",
              )}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {running ? (
          <>
            <ControlButton
              icon={<Square size={13} strokeWidth={2} />}
              label={t("Stop")}
              busy={acting}
              onClick={() => void stop()}
            />
            <ControlButton
              icon={<RotateCw size={13} strokeWidth={2} />}
              label={t("Restart")}
              busy={acting}
              onClick={() => void start()}
            />
          </>
        ) : (
          <ControlButton
            icon={<Play size={13} strokeWidth={2} />}
            label={t("Start server")}
            busy={acting || engine === "checking"}
            onClick={() => void start()}
          />
        )}
      </div>

      <div className="h-px bg-edge-soft" />

      <ToggleRow
        label={t("Harbor in your browser")}
        sub={t(
          "Serves this exact install of Harbor as a web app on your network. Open it on a phone, laptop, or TV browser, sign in there, and it streams through this computer. You can also use the phone remote to control playback and cast to another device on this machine.",
        )}
        value={settings.serveWebUi || settings.remoteControlEnabled}
        onChange={(v) => update({ serveWebUi: v, remoteControlEnabled: v })}
      />
      {(settings.serveWebUi || settings.remoteControlEnabled) && (
        <>
          <AddressRow
            label={t("Harbor in your browser (this computer)")}
            url={`http://127.0.0.1:${WEB_PORT}`}
            openable
          />
          {lanIp && (
            <AddressRow
              label={t("Harbor in your browser (Wi-Fi)")}
              url={`http://${lanIp}:${WEB_PORT}`}
            />
          )}
          <AddressRow
            label={t("Phone remote (this computer)")}
            url={`http://127.0.0.1:${WEB_PORT}/remote`}
            openable
          />
          {lanIp && (
            <AddressRow
              label={t("Phone remote (Wi-Fi)")}
              url={`http://${lanIp}:${WEB_PORT}/remote`}
            />
          )}
          {webError && (
            <span className="text-[12px] text-danger">
              {t(
                "Couldn't start on port {WEB_PORT}. Another app may be using it; toggle off and on to retry.",
                { WEB_PORT: String(WEB_PORT) },
              )}
            </span>
          )}
        </>
      )}
    </section>
  );
}
