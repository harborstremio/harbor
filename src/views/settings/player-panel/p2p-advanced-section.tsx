import { Dropdown } from "@/components/dropdown";
import { useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  ClipboardCopy,
  Clock,
  FolderOpen,
  HardDrive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  torrentEngineHardReset,
  torrentEngineSetOptions,
  torrentEngineStatus,
} from "@/lib/torrent/local-engine";
import { Section, ToggleRow } from "../shared";
import { ModalButton, SettingGroup, SettingRow, SettingsModal, ROW_ACTION } from "../kit";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const RETENTIONS: Array<{ h: number; label: string }> = [
  { h: 0, label: "Off" },
  { h: 12, label: "12 hours" },
  { h: 24, label: "1 day" },
  { h: 72, label: "3 days" },
  { h: 168, label: "1 week" },
  { h: 876000, label: "Forever" },
];

const CACHE_LIMITS: Array<{ gb: number; label: string }> = [
  { gb: 0, label: "Unlimited" },
  { gb: 10, label: "10 GB" },
  { gb: 20, label: "20 GB" },
  { gb: 25, label: "25 GB" },
  { gb: 50, label: "50 GB" },
  { gb: 100, label: "100 GB" },
];

function StateIcon({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-md ${
        on ? "bg-accent-soft text-accent" : "bg-raised text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}

function useCachePath(customDir: string): string {
  const [defaultPath, setDefaultPath] = useState("");
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
  return customDir ? `${customDir}/harbor-stream-cache` : defaultPath;
}

export function StreamCacheSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [manage, setManage] = useState(false);

  const retention = settings.streamCacheRetentionHours;
  const maxGb = settings.streamCacheMaxGb;
  const knownRetention = RETENTIONS.some((r) => r.h === retention);
  const knownMaxGb = CACHE_LIMITS.some((c) => c.gb === maxGb);
  const customDir = settings.streamCacheDir;
  const cachePath = useCachePath(customDir);

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

  return (
    <Section
      title={t("Stream cache")}
      subtitle={t(
        "Downloaded peer-to-peer stream files are kept on disk so reopening a title resumes instantly instead of starting over. Control how long they stay and where they live.",
      )}
    >
      <SettingGroup label={t("How long files stay")}>
        <SettingRow
          icon={<Clock size={16} strokeWidth={1.9} />}
          label={t("Keep cached files for")}
          desc={t("Reopening a title within this window resumes instead of re-downloading.")}
          tip={t(
            "After you stop watching, a stream file stays cached for this long so reopening resumes instead of re-downloading. Older files are cleaned up automatically. Off deletes the file as soon as you leave the player.",
          )}
        >
          <Dropdown
            size="sm"
            value={String(retention)}
            onChange={(v) => setRetention(Number(v))}
            className="w-[200px] shrink-0"
            options={[
              ...RETENTIONS.map((r) => ({ value: String(r.h), label: t(r.label) })),
              ...(knownRetention
                ? []
                : [{ value: String(retention), label: t("{n} hours", { n: retention }) }]),
            ]}
          />
        </SettingRow>

        <SettingRow
          icon={<HardDrive size={16} strokeWidth={1.9} />}
          label={t("Keep at most")}
          desc={t("Over the cap, the oldest files are deleted first.")}
          tip={t(
            "Cap how much disk the cache can use. When it goes over, Harbor deletes the oldest files first. Enforced on launch and as streams close.",
          )}
        >
          <Dropdown
            size="sm"
            value={String(maxGb)}
            onChange={(v) => setMaxGb(Number(v))}
            className="w-[200px] shrink-0"
            options={[
              ...CACHE_LIMITS.map((c) => ({ value: String(c.gb), label: t(c.label) })),
              ...(knownMaxGb ? [] : [{ value: String(maxGb), label: t("{n} GB", { n: maxGb }) }]),
            ]}
          />
        </SettingRow>

        <ToggleRow
          label={t("Delete after I finish watching")}
          sub={t(
            "When you finish an episode or movie, remove its downloaded file right away. Something you stop partway through is kept so you can resume.",
          )}
          leading={
            <StateIcon on={settings.deleteWatchedDownloads}>
              <Trash2 size={16} strokeWidth={2.2} />
            </StateIcon>
          }
          value={settings.deleteWatchedDownloads}
          onChange={(v) => update({ deleteWatchedDownloads: v })}
        />
      </SettingGroup>

      {isTauri && (
        <SettingGroup label={t("Where files live")}>
          <SettingRow
            icon={<FolderOpen size={16} strokeWidth={1.9} />}
            label={t("Cache location")}
            desc={
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate font-mono text-[12.5px] text-ink" title={cachePath}>
                  {cachePath || t("Default app cache folder")}
                </span>
                {!customDir && (
                  <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-subtle">
                    {t("Default")}
                  </span>
                )}
              </span>
            }
          >
            <button type="button" onClick={() => setManage(true)} className={ROW_ACTION}>
              <FolderOpen size={14} strokeWidth={2.2} />
              {t("Manage")}
            </button>
          </SettingRow>
        </SettingGroup>
      )}

      <SettingsModal
        open={manage}
        onClose={() => {
          setManage(false);
          setConfirmClear(false);
        }}
        title={t("Cache location")}
        sub={t(
          "Changing the location restarts the engine. Clearing removes all cached stream files right away; anything you reopen will re-fetch.",
        )}
        actions={
          <ModalButton
            ghost
            onClick={() => {
              setManage(false);
              setConfirmClear(false);
            }}
          >
            {t("Done")}
          </ModalButton>
        }
      >
        <SettingRow wide label={t("Current folder")}>
          <span className="w-full break-all rounded-md bg-canvas px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink">
            {cachePath || t("Default app cache folder")}
          </span>
        </SettingRow>

        <SettingRow
          label={t("Change folder")}
          desc={t("Pick a drive with room to spare. Files already cached stay where they are.")}
        >
          <button type="button" onClick={() => void pickDir()} className={ROW_ACTION}>
            <FolderOpen size={14} strokeWidth={2.2} />
            {t("Change…")}
          </button>
          {!!customDir && (
            <button type="button" onClick={resetDir} className={ROW_ACTION}>
              <RotateCcw size={14} strokeWidth={2.2} />
              {t("Reset")}
            </button>
          )}
        </SettingRow>

        <SettingRow
          label={t("Clear cache now")}
          desc={t("Deletes every cached stream file and restarts the engine.")}
        >
          <button
            type="button"
            onClick={() => void clearCache()}
            disabled={clearing}
            onMouseLeave={() => setConfirmClear(false)}
            className={`harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
              confirmClear ? "bg-danger/15 text-danger" : "bg-raised text-ink-muted hover:text-danger"
            }`}
          >
            {clearing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} strokeWidth={2.2} />
            )}
            {clearing ? t("Clearing…") : confirmClear ? t("Confirm clear") : t("Clear cache now")}
          </button>
        </SettingRow>
      </SettingsModal>
    </Section>
  );
}

export function P2PPowerToolsSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const strictRemote = !!settings.remoteStreamServerUrl && settings.remoteStreamServerStrict;
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const cachePath = useCachePath(settings.streamCacheDir);

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
    <Section
      title={t("Power tools & diagnostics")}
      subtitle={t(
        "Low-level knobs for the peer-to-peer engine, plus quick ways to grab debug info when a stream misbehaves.",
      )}
    >
      <SettingGroup label={t("Torrent streaming")}>
        <ToggleRow
          label={t("Disable torrents entirely")}
          sub={t(
            "Harbor will not start the torrent engine, contact trackers, or run DHT. Use this if you only want debrid and direct links. Turn off to re-enable torrent streaming.",
          )}
          leading={
            <StateIcon on={settings.torrentsDisabled}>
              <Ban size={16} strokeWidth={2.2} />
            </StateIcon>
          }
          value={settings.torrentsDisabled}
          onChange={(v) => {
            update({ torrentsDisabled: v });
            if (isTauri && v) {
              void import("@tauri-apps/api/core").then(({ invoke }) =>
                invoke("torrent_engine_hard_reset").catch(() => {}),
              );
            }
          }}
          warn={
            settings.torrentsDisabled
              ? t(
                  "Torrents are disabled. Uncached streams will not play unless they come from a debrid service or a direct link. To use torrents, toggle this off.",
                )
              : undefined
          }
        />

        <ToggleRow
          label={t("Direct torrent streaming")}
          sub={t(
            "Stream torrents straight from Harbor's built-in engine when you have no debrid set up, or a torrent isn't cached. This connects to peers over your own connection. Turn off to only ever play debrid and direct links.",
          )}
          leading={
            <StateIcon on={settings.directTorrentStream && !settings.torrentsDisabled && !strictRemote}>
              <Zap size={16} strokeWidth={2.2} />
            </StateIcon>
          }
          value={settings.directTorrentStream}
          onChange={(v) => update({ directTorrentStream: v })}
          lockReason={
            settings.torrentsDisabled
              ? t("Disabled because torrents are disabled above")
              : strictRemote
                ? t("Disabled while strict remote streaming is on")
                : undefined
          }
        />

        <ToggleRow
          label={t("Auto-confirm peer-to-peer streaming")}
          sub={t(
            "Skip the 'stream over peer-to-peer?' prompt and start uncached torrents immediately. Harbor remembers your choice after the first confirmation anyway.",
          )}
          leading={
            <StateIcon on={settings.p2pAutoConsent && !settings.torrentsDisabled}>
              <ShieldCheck size={16} strokeWidth={2.2} />
            </StateIcon>
          }
          value={settings.p2pAutoConsent}
          onChange={(v) => update({ p2pAutoConsent: v })}
          note={
            settings.torrentsDisabled
              ? t("Nothing left to confirm while torrents are disabled.")
              : undefined
          }
        />
      </SettingGroup>

      <SettingGroup label={t("Diagnostics")}>
        <SettingRow
          icon={<ClipboardCopy size={16} strokeWidth={1.9} />}
          label={t("Copy diagnostics")}
          desc={t("Engine status and your P2P settings as JSON, ready to paste into a bug report.")}
          tip={t(
            "Copy diagnostics grabs the engine status and your P2P settings as JSON, handy to paste into a bug report. The engine folder holds the DHT cache (dht.json) and active torrent data.",
          )}
        >
          <button type="button" onClick={() => void copyDiagnostics()} className={ROW_ACTION}>
            {copied ? (
              <Check size={14} strokeWidth={2.6} className="text-success" />
            ) : (
              <ClipboardCopy size={14} strokeWidth={2.2} />
            )}
            {copied ? t("Copied") : t("Copy diagnostics")}
          </button>
        </SettingRow>

        {isTauri && (
          <SettingRow
            icon={<FolderOpen size={16} strokeWidth={1.9} />}
            label={t("Reveal engine folder")}
            desc={t("Opens the folder holding the DHT cache and active torrent data.")}
          >
            <button
              type="button"
              onClick={() => void revealEngineFolder()}
              disabled={opening}
              className={ROW_ACTION}
            >
              {opening ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FolderOpen size={14} strokeWidth={2.2} />
              )}
              {t("Reveal engine folder")}
            </button>
          </SettingRow>
        )}
      </SettingGroup>
    </Section>
  );
}

export function P2PAdvancedSection() {
  return (
    <>
      <StreamCacheSection />
      <P2PPowerToolsSection />
    </>
  );
}
