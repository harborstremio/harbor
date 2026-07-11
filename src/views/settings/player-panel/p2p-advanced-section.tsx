import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { torrentEngineHardReset, torrentEngineSetOptions, torrentEngineStatus } from "@/lib/torrent/local-engine";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Check, ClipboardCopy, FolderOpen, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Section, ToggleRow } from "../shared";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const RETENTIONS: Array<{ h: number; label: string }> = [
  { h: 0, label: "Off" },
  { h: 24, label: "1 day" },
  { h: 72, label: "3 days" },
  { h: 168, label: "1 week" },
  { h: 876000, label: "Forever" },
];

const CACHE_LIMITS: Array<{ gb: number; label: string }> = [
  { gb: 0, label: "Unlimited" },
  { gb: 10, label: "10 GB" },
  { gb: 25, label: "25 GB" },
  { gb: 50, label: "50 GB" },
  { gb: 100, label: "100 GB" },
];

export function P2PAdvancedSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const strictRemote = !!settings.remoteStreamServerUrl && settings.remoteStreamServerStrict;
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [defaultPath, setDefaultPath] = useState("");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    void (async () => {
      try {
        setDefaultPath(await join(await appCacheDir(), "engine"));
      } catch {
        /* engine dir not created until the engine runs once */
      }
    })();
  }, []);

  const retention = settings.streamCacheRetentionHours;
  const maxGb = settings.streamCacheMaxGb;
  const customDir = settings.streamCacheDir;
  const cachePath = customDir ? `${customDir}/harbor-stream-cache` : defaultPath;

  const setRetention = (h: number) => {
    update({ streamCacheRetentionHours: h });
    void torrentEngineSetOptions(customDir || null, h, maxGb, false);
  };
  const setMaxGb = (g: number) => {
    update({ streamCacheMaxGb: g });
    void torrentEngineSetOptions(customDir || null, retention, g, false);
  };
  const pickDir = async () => {
    const picked = await open({ directory: true, defaultPath: customDir || undefined });
    if (typeof picked === "string") {
      update({ streamCacheDir: picked });
      void torrentEngineSetOptions(picked, retention, maxGb, true);
    }
  };
  const resetDir = () => {
    update({ streamCacheDir: "" });
    void torrentEngineSetOptions(null, retention, maxGb, true);
  };
  const clearCache = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    setClearing(true);
    try {
      await torrentEngineHardReset();
    } finally {
      setClearing(false);
    }
  };

  const copyDiagnostics = async () => {
    const status = await torrentEngineStatus();
    const diag = {
      engine: status,
      directTorrentStream: settings.directTorrentStream,
      p2pAutoConsent: settings.p2pAutoConsent,
      remoteStreamServerUrl: settings.remoteStreamServerUrl || null,
      remoteStreamServerStrict: settings.remoteStreamServerStrict,
      userAgent: navigator.userAgent,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const revealEngineFolder = async () => {
    if (!isTauri) return;
    setOpening(true);
    try {
      await revealItemInDir(cachePath || (await join(await appCacheDir(), "engine")));
    } catch {
      /* folder not created until the engine runs once */
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <Section
        title={t("Stream cache")}
        subtitle={t(
          "Downloaded peer-to-peer stream files are kept on disk so reopening a title resumes instantly instead of starting over. Control how long they stay and where they live.",
        )}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold text-ink">{t("Keep cached files for")}</span>
          <p className="text-[12px] leading-relaxed text-ink-subtle">
            {t(
              "After you stop watching, a stream file stays cached for this long so reopening resumes instead of re-downloading. Older files are cleaned up automatically. Off deletes the file as soon as you leave the player.",
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RETENTIONS.map((r) => (
              <button
                key={r.h}
                type="button"
                onClick={() => setRetention(r.h)}
                className={`h-9 rounded-lg px-3.5 text-[12.5px] font-semibold transition-colors ${
                  retention === r.h
                    ? "bg-ink text-canvas"
                    : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
                }`}
              >
                {t(r.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[13.5px] font-semibold text-ink">{t("Keep at most")}</span>
          <p className="text-[12px] leading-relaxed text-ink-subtle">
            {t(
              "Cap how much disk the cache can use. When it goes over, Harbor deletes the oldest files first. Enforced on launch and as streams close.",
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CACHE_LIMITS.map((c) => (
              <button
                key={c.gb}
                type="button"
                onClick={() => setMaxGb(c.gb)}
                className={`h-9 rounded-lg px-3.5 text-[12.5px] font-semibold transition-colors ${
                  maxGb === c.gb
                    ? "bg-ink text-canvas"
                    : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
                }`}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
        </div>

        <ToggleRow
          label={t("Delete after I finish watching")}
          sub={t(
            "When you finish an episode or movie, remove its downloaded file right away. Something you stop partway through is kept so you can resume.",
          )}
          value={settings.deleteWatchedDownloads}
          onChange={(v) => update({ deleteWatchedDownloads: v })}
        />

        {isTauri && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[13.5px] font-semibold text-ink">{t("Cache location")}</span>
            <p className="truncate text-[12px] text-ink-subtle" title={cachePath}>
              {cachePath || t("Default app cache folder")}
              {!customDir && <span className="ms-1.5 text-ink-subtle/70">({t("Default")})</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void pickDir()}
                className="flex h-10 items-center gap-2 rounded-lg border border-edge-soft px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                <FolderOpen size={14} strokeWidth={2.2} />
                {t("Change…")}
              </button>
              {!!customDir && (
                <button
                  type="button"
                  onClick={resetDir}
                  className="flex h-10 items-center gap-2 rounded-lg border border-edge-soft px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  <RotateCcw size={14} strokeWidth={2.2} />
                  {t("Reset")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void clearCache()}
                disabled={clearing}
                onMouseLeave={() => setConfirmClear(false)}
                className={`flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                  confirmClear
                    ? "bg-danger text-white"
                    : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
                }`}
              >
                {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2.2} />}
                {clearing ? t("Clearing…") : confirmClear ? t("Confirm clear") : t("Clear cache now")}
              </button>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-subtle">
              {t(
                "Changing the location restarts the engine. Clearing removes all cached stream files right away; anything you reopen will re-fetch.",
              )}
            </p>
          </div>
        )}
      </Section>

      <Section
        title={t("Power tools & diagnostics")}
        subtitle={t(
          "Low-level knobs for the peer-to-peer engine, plus quick ways to grab debug info when a stream misbehaves.",
        )}
      >
        <ToggleRow
          label={t("Direct torrent streaming")}
          sub={t(
            "Stream torrents straight from Harbor's built-in engine when you have no debrid set up, or a torrent isn't cached. This connects to peers over your own connection. Turn off to only ever play debrid and direct links.",
          )}
          value={settings.directTorrentStream}
          onChange={(v) => update({ directTorrentStream: v })}
          lockReason={strictRemote ? t("Disabled while strict remote streaming is on") : undefined}
        />
        <ToggleRow
          label={t("Auto-confirm peer-to-peer streaming")}
          sub={t(
            "Skip the 'stream over peer-to-peer?' prompt and start uncached torrents immediately. Harbor remembers your choice after the first confirmation anyway.",
          )}
          value={settings.p2pAutoConsent}
          onChange={(v) => update({ p2pAutoConsent: v })}
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void copyDiagnostics()}
            className="flex h-10 items-center gap-2 rounded-lg border border-edge-soft px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {copied ? (
              <Check size={14} strokeWidth={2.6} className="text-emerald-400" />
            ) : (
              <ClipboardCopy size={14} strokeWidth={2.2} />
            )}
            {copied ? t("Copied") : t("Copy diagnostics")}
          </button>
          {isTauri && (
            <button
              type="button"
              onClick={() => void revealEngineFolder()}
              disabled={opening}
              className="flex h-10 items-center gap-2 rounded-lg border border-edge-soft px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-60"
            >
              {opening ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} strokeWidth={2.2} />}
              {t("Reveal engine folder")}
            </button>
          )}
        </div>
        <p className="text-[12px] leading-relaxed text-ink-subtle">
          {t(
            "Copy diagnostics grabs the engine status and your P2P settings as JSON, handy to paste into a bug report. The engine folder holds the DHT cache (dht.json) and active torrent data.",
          )}
        </p>
      </Section>
    </>
  );
}
