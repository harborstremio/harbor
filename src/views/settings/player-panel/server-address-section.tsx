import { Check, Copy, ExternalLink, Globe, Loader2, Play, RotateCw, Server, Square } from "../icons";
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
import { SettingGroup, SettingRow, ROW_ACTION, ROW_DESC } from "../kit";
import { BADGE_BASE } from "./choice";
import { isTauri } from "./internals";
import { useT } from "@/lib/i18n";

type EngineState = "checking" | "running" | "starting" | "stopped";

const PORT_TAKEN_RE = /unavailable|in use|EADDRINUSE|10048/i;

const PILL: Record<EngineState, { dot: string; chip: string }> = {
  checking: { dot: "bg-ink-subtle", chip: "bg-elevated text-ink-subtle" },
  running: { dot: "bg-success", chip: "bg-elevated text-success" },
  starting: { dot: "bg-accent", chip: "bg-accent-soft text-accent" },
  stopped: { dot: "bg-danger", chip: "bg-elevated text-danger" },
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
      icon={<Globe size={18} strokeWidth={1.9} />}
      label={label}
      desc={
        <span className="block break-all font-mono text-[15.5px] leading-[22px] text-ink">
          {url}
        </span>
      }
    >
      <button type="button" onClick={copy} aria-label={t("Copy {label} address", { label })} className={ROW_ACTION}>
        {copied ? (
          <Check size={16} strokeWidth={2.4} className="text-success" />
        ) : (
          <Copy size={16} strokeWidth={1.9} />
        )}
        {copied ? t("Copied") : t("Copy")}
      </button>
      {openable && (
        <button type="button" onClick={() => openUrl(url)} aria-label={t("Open {label} address", { label })} className={ROW_ACTION}>
          <ExternalLink size={16} strokeWidth={1.9} />
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
    <button
      type="button"
      onClick={busy ? undefined : onClick}
      aria-disabled={busy}
      className={`${ROW_ACTION}${busy ? " pointer-events-none opacity-45" : ""}`}
    >
      {busy ? <Loader2 size={16} strokeWidth={1.9} className="animate-spin" /> : icon}
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
        "To stream from this computer on another device, copy its local network address and enter it in Remote streaming server on that device.",
      )}
    >
      <SettingGroup label={t("Server")}>
        <SettingRow
          icon={<Server size={18} strokeWidth={1.9} />}
          label={
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0">{t("Streaming server")}</span>
              <span className={`${BADGE_BASE} gap-1.5 ${pill.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                {pillLabel}
              </span>
            </span>
          }
          desc={t("Handles torrent playback and transcoding for this machine.")}
        >
          {running ? (
            <>
              <ControlButton
                icon={<Square size={16} strokeWidth={2} />}
                label={t("Stop")}
                busy={acting}
                onClick={() => void stop()}
              />
              <ControlButton
                icon={<RotateCw size={16} strokeWidth={2} />}
                label={t("Restart")}
                busy={acting}
                onClick={() => void start()}
              />
            </>
          ) : (
            <ControlButton
              icon={<Play size={16} strokeWidth={2} />}
              label={t("Start server")}
              busy={acting || engine === "checking"}
              onClick={() => void start()}
            />
          )}
        </SettingRow>

        {engine === "stopped" && lastError && (
          <div className="flex flex-col gap-1.5 rounded-[10px] bg-elevated px-4 py-3">
            <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-danger">
              <span className="font-semibold">{t("Server couldn't start:")}</span> {lastError}
            </span>
            {PORT_TAKEN_RE.test(lastError) && (
              <span className={`max-w-[66ch] ${ROW_DESC}`}>
                {t(
                  "Another program already holds this port, usually a Stremio server that is running on this machine. Harbor tried its spare ports too. Stop that server, or leave it running and point Harbor at it in Remote streaming server below.",
                )}
              </span>
            )}
            {/not bundled/i.test(lastError) && (
              <span className={`max-w-[66ch] ${ROW_DESC}`}>
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
        {lanIp && <AddressRow label={t("On your local network")} url={`http://${lanIp}:${port}`} />}
      </SettingGroup>

      <p className={`max-w-[70ch] ${ROW_DESC}`}>
        {t(
          "Looking for Harbor in your browser, the phone remote, or the manga reader remote? They moved to the Remotes page.",
        )}
      </p>
    </Section>
  );
}
