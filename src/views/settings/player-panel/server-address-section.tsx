import { Check, Copy, ExternalLink, Globe, Loader2, Play, RotateCw, Server, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  bundledServerPort,
  bundledServerUrl,
  getCastServerStatus,
  restartCastServer,
} from "@/lib/stremio-server";
import { openUrl } from "@/lib/window";
import { Section } from "../shared";
import { SettingGroup, SettingRow, ROW_ACTION } from "../kit";
import { isTauri } from "./internals";
import { useT } from "@/lib/i18n";

type EngineState = "checking" | "running" | "starting" | "stopped";

const PORT_TAKEN_RE = /unavailable|in use|EADDRINUSE|10048/i;

const PILL: Record<EngineState, { dot: string; chip: string }> = {
  checking: { dot: "bg-ink-subtle", chip: "bg-raised text-ink-muted" },
  running: { dot: "bg-success", chip: "bg-success/15 text-success" },
  starting: { dot: "bg-accent", chip: "bg-accent-soft text-accent" },
  stopped: { dot: "bg-danger", chip: "bg-danger/15 text-danger" },
};

async function probeBundled(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${bundledServerUrl()}/settings`, { method: "GET", signal: ctrl.signal });
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
  if (s) return "stopped";
  return (await probeBundled()) ? "running" : "stopped";
}

export function AddressRow({ label, url, openable }: { label: string; url: string; openable?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <SettingRow
      icon={<Globe size={16} strokeWidth={1.9} />}
      label={label}
      desc={
        <span className="block truncate font-mono text-[12.5px] text-ink" title={url}>
          {url}
        </span>
      }
    >
      <button
        type="button"
        onClick={copy}
        className={`harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold transition-colors ${
          copied ? "bg-success/15 text-success" : "bg-raised text-ink-muted hover:text-ink"
        }`}
      >
        {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={1.9} />}
        {copied ? t("Copied") : t("Copy")}
      </button>
      {openable && (
        <button type="button" onClick={() => openUrl(url)} className={ROW_ACTION}>
          <ExternalLink size={14} strokeWidth={1.9} />
          {t("Open")}
        </button>
      )}
    </SettingRow>
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
    <button type="button" disabled={busy} onClick={onClick} className={ROW_ACTION}>
      {busy ? <Loader2 size={14} strokeWidth={1.9} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

export function ServerAddressSection() {
  const t = useT();
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [engine, setEngine] = useState<EngineState>("checking");
  const [port, setPort] = useState(bundledServerPort());
  const [acting, setActing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const refresh = async () => {
    const next = await readEngineState();
    const s = await getCastServerStatus();
    if (aliveRef.current) {
      setEngine(next);
      setPort(bundledServerPort());
      setLastError(next === "stopped" ? s?.last_error ?? null : null);
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

  if (!isTauri) return null;

  const pill = PILL[engine];
  const running = engine === "running" || engine === "starting";

  const pillLabel =
    engine === "checking"
      ? t("Checking")
      : engine === "running"
        ? t("Running")
        : engine === "starting"
          ? t("Starting")
          : t("Not running");

  const start = async () => {
    setActing(true);
    setEngine("starting");
    setLastError(null);
    const failure = await restartCastServer();
    if (failure) {
      if (aliveRef.current) {
        setEngine("stopped");
        setLastError(failure);
        setActing(false);
      }
      return;
    }
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
    <Section
      title={t("Your streaming server address")}
      subtitle={t(
        "Harbor runs a small streaming server right on this computer. This is where it lives. To stream from this machine on another device, copy the Wi-Fi address and paste it into Remote streaming server in Harbor over there.",
      )}
    >
      <SettingGroup label={t("Server")}>
        <SettingRow
          icon={<Server size={16} strokeWidth={1.9} />}
          label={
            <>
              {t("Streaming server")}
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wider ${pill.chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                {pillLabel}
              </span>
            </>
          }
          desc={t("Handles torrent playback and transcoding for this machine.")}
        >
          {running ? (
            <>
              <ControlButton
                icon={<Square size={14} strokeWidth={2} />}
                label={t("Stop")}
                busy={acting}
                onClick={() => void stop()}
              />
              <ControlButton
                icon={<RotateCw size={14} strokeWidth={2} />}
                label={t("Restart")}
                busy={acting}
                onClick={() => void start()}
              />
            </>
          ) : (
            <ControlButton
              icon={<Play size={14} strokeWidth={2} />}
              label={t("Start server")}
              busy={acting || engine === "checking"}
              onClick={() => void start()}
            />
          )}
        </SettingRow>

        {engine === "stopped" && lastError && (
          <div className="flex flex-col gap-1.5 rounded-md bg-elevated px-4 py-3.5">
            <span className="text-[12.5px] leading-relaxed text-danger">
              <span className="font-semibold">{t("Server couldn't start:")}</span> {lastError}
            </span>
            {PORT_TAKEN_RE.test(lastError) && (
              <span className="text-[12.5px] leading-relaxed text-ink-muted">
                {t(
                  "Another program already holds this port, usually a Stremio server that is running on this machine. Harbor tried its spare ports too. Stop that server, or leave it running and point Harbor at it in Remote streaming server below.",
                )}
              </span>
            )}
            {/not bundled/i.test(lastError) && (
              <span className="text-[12.5px] leading-relaxed text-ink-muted">
                {t(
                  "This usually means antivirus removed the server file (stremio-server.exe). Add Harbor's install folder to your antivirus exclusions, then reinstall.",
                )}
              </span>
            )}
          </div>
        )}
      </SettingGroup>

      <SettingGroup label={t("Addresses")}>
        <AddressRow label={t("On this computer")} url={`http://127.0.0.1:${port}`} openable={running} />
        {lanIp && <AddressRow label={t("From other devices on your Wi-Fi")} url={`http://${lanIp}:${port}`} />}
      </SettingGroup>

      <p className="px-1 text-[12.5px] leading-relaxed text-ink-subtle">
        {t(
          "Looking for Harbor in your browser, the phone remote, or the manga reader remote? They moved to the Remotes page.",
        )}
      </p>
    </Section>
  );
}
