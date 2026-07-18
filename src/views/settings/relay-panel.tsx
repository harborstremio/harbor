import {
  BookOpen,
  Check,
  Copy,
  Download,
  Loader2,
  Power,
  Radio,
  ShieldCheck,
  Wifi,
  X,
} from "lucide-react";
import { useState } from "react";
import cloudflareLogo from "@/assets/cloudflare.webp";
import pubRelaySvg from "@/assets/pubrelay.svg";
import { deleteRelay } from "@/lib/together/cf-deploy";
import { HARBOR_PUBLIC_RELAY, isPublicRelay } from "@/lib/together/relay-version";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { downloadText } from "@/lib/download-text";
import { useRelayHealth } from "./relay-panel/use-relay-health";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function isCloudflareRelay(url: string): boolean {
  return /workers\.dev|cloudflare/i.test(url);
}

export function TogetherRelayPanel({
  onOpenDocs,
  onOpenDeploy,
}: {
  onOpenDocs: () => void;
  onOpenDeploy: () => void;
}) {
  const { settings, update } = useSettings();
  const t = useT();
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { testing, testResult, runTest, passive } = useRelayHealth(settings.togetherRelayUrl);
  const [draftUrl, setDraftUrl] = useState("");
  const setShowDocs = (_: boolean) => onOpenDocs();
  const setShowDeploy = (_: boolean) => onOpenDeploy();

  const hasUrl = !!settings.togetherRelayUrl;
  const isCfRelay = isCloudflareRelay(settings.togetherRelayUrl);
  const isPubRelay = hasUrl && isPublicRelay(settings.togetherRelayUrl);

  const commitDraftUrl = () => {
    const v = draftUrl.trim();
    if (v) update({ togetherRelayUrl: v });
  };
  const isManaged =
    settings.togetherCfDeployed && !!settings.togetherCfToken && !!settings.togetherCfAccountId;

  const copy = async () => {
    if (!settings.togetherRelayUrl) return;
    await navigator.clipboard.writeText(settings.togetherRelayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const exportBackup = async () => {
    const payload = {
      harbor: "relay-credentials",
      version: 1,
      exportedAt: new Date().toISOString(),
      relayUrl: settings.togetherRelayUrl,
      cloudflare: {
        accountId: settings.togetherCfAccountId,
        apiToken: settings.togetherCfToken,
      },
      notes: [
        "Keep this file safe and offline. Cloudflare shows API tokens only once at creation. Without this token, Harbor cannot stop, redeploy, or update this relay through its UI.",
        "To restore: open Settings -> Harbor Relay, paste the relayUrl, and re-enter the API token if you plan to manage from Harbor.",
        "You can always delete the underlying Worker manually at dash.cloudflare.com -> Workers & Pages, even without this file.",
      ],
    };
    await downloadText(
      `harbor-relay-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      ["json"],
      "Harbor relay backup",
    );
  };

  const stop = async () => {
    if (!isManaged) return;
    setStopError(null);
    setStopping(true);
    try {
      await deleteRelay(settings.togetherCfToken, settings.togetherCfAccountId);
      update({
        togetherRelayUrl: "",
        togetherCfDeployed: false,
      });
    } catch (e) {
      setStopError(e instanceof Error ? e.message : String(e));
    } finally {
      setStopping(false);
    }
  };

  return (
    <>
      {hasUrl ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-edge bg-canvas/60 p-4">
            {isPubRelay ? (
              <img
                src={pubRelaySvg}
                alt="Harbor public relay"
                className="h-14 w-14 shrink-0 object-contain"
                draggable={false}
              />
            ) : (
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${
                  isCfRelay ? "bg-[#f6821f]/15 ring-[#f6821f]/30" : "bg-accent/15 ring-accent/30"
                }`}
              >
                {isCfRelay ? (
                  <img
                    src={cloudflareLogo}
                    alt="Cloudflare"
                    className="h-5 w-5 object-contain"
                    draggable={false}
                  />
                ) : (
                  <Radio size={18} strokeWidth={1.9} className="text-accent" />
                )}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
                {isManaged ? t("Your relay is live") : t("Connected to relay")}
              </span>
              <span className="truncate font-mono text-[13px] text-ink">
                {settings.togetherRelayUrl}
              </span>
            </div>
            <button
              onClick={copy}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-edge px-3 text-[13px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {copied ? (
                <Check size={14} strokeWidth={2.2} />
              ) : (
                <Copy size={14} strokeWidth={1.8} />
              )}
              {copied ? t("Copied") : t("Copy")}
            </button>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-edge-soft bg-canvas/40 p-1">
            <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-ink">{t("Watch Together")}</span>
                <span className="text-[11.5px] text-ink-subtle">
                  {t("Synchronizes playback state between participants in the same room.")}
                </span>
              </div>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-accent">
                {t("Active")}
              </span>
            </div>
            <div className="h-px bg-edge-soft/60" />
            <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium text-ink">{t("Test connection")}</span>
                <span className="text-[11.5px] text-ink-subtle">
                  {t("Pings your Worker at /health to confirm it's reachable from this device.")}
                </span>
              </div>
              <button
                onClick={runTest}
                disabled={testing}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-60"
              >
                {testing ? (
                  <Loader2 size={13} strokeWidth={1.9} className="animate-spin" />
                ) : (
                  <Wifi size={13} strokeWidth={1.9} />
                )}
                {testing ? t("Testing…") : t("Run test")}
              </button>
            </div>
            {passive && (
              <>
                <div className="h-px bg-edge-soft/60" />
                <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        passive.needsUpdate
                          ? "bg-amber-400/15 text-amber-300"
                          : "bg-accent/15 text-accent"
                      }`}
                    >
                      <ShieldCheck size={13} strokeWidth={2} />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[13px] font-medium text-ink">
                        {passive.needsUpdate
                          ? t("Relay version {version}. Update available.", {
                              version: passive.version ?? t("unknown"),
                            })
                          : t("Relay is current (v{version}).", { version: passive.version ?? "" })}
                      </span>
                      <span className="text-[11.5px] text-ink-subtle">
                        {passive.needsUpdate
                          ? isPubRelay
                            ? t("Harbor's public relay updates automatically; nothing to do.")
                            : t(
                                "Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.",
                              )
                          : t("Running the latest Watch Together protocol.")}
                      </span>
                    </div>
                  </div>
                  {passive.needsUpdate && !isPubRelay && (
                    <button
                      onClick={() => (isManaged ? setShowDeploy(true) : setShowDocs(true))}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                    >
                      {isManaged ? (
                        <Power size={13} strokeWidth={2} />
                      ) : (
                        <BookOpen size={13} strokeWidth={1.9} />
                      )}
                      {isManaged ? t("Redeploy") : t("Redeploy instructions")}
                    </button>
                  )}
                </div>
              </>
            )}
            {isManaged && (
              <>
                <div className="h-px bg-edge-soft/60" />
                <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium text-ink">
                      {t("Backup credentials")}
                    </span>
                    <span className="text-[11.5px] text-ink-subtle">
                      {t(
                        "Cloudflare shows API tokens only once. Save a copy now or you'll lose the ability to stop or redeploy this relay from Harbor.",
                      )}
                    </span>
                  </div>
                  <button
                    onClick={exportBackup}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                  >
                    <Download size={13} strokeWidth={1.9} />
                    {t("Export")}
                  </button>
                </div>
              </>
            )}
          </div>

          {testResult && (
            <div
              className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${
                testResult.ok ? "border-accent/40 bg-accent/10" : "border-danger/40 bg-danger/10"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    testResult.ok ? "bg-accent/25 text-accent" : "bg-danger/25 text-danger"
                  }`}
                >
                  {testResult.ok ? (
                    <Check size={12} strokeWidth={2.4} />
                  ) : (
                    <X size={12} strokeWidth={2.4} />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={`text-[12.5px] font-medium ${testResult.ok ? "text-ink" : "text-danger"}`}
                  >
                    {testResult.ok ? t("Relay verified end-to-end") : t("Relay test failed")}
                  </span>
                  <span className="text-[11.5px] text-ink-subtle">{testResult.message}</span>
                </div>
              </div>
              {testResult.needsUpdate && !isPubRelay && (
                <button
                  onClick={() => (isManaged ? setShowDeploy(true) : setShowDocs(true))}
                  className="ms-7 flex h-8 w-fit items-center gap-1.5 rounded-lg bg-ink px-3 text-[11.5px] font-medium text-canvas transition-transform hover:scale-[1.02]"
                >
                  <Power size={12} strokeWidth={2} />
                  {isManaged ? t("Redeploy relay") : t("Redeploy instructions")}
                </button>
              )}
            </div>
          )}

          {isManaged ? (
            <div className="flex items-center gap-2">
              <button
                onClick={stop}
                disabled={stopping}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-danger/40 text-[13px] text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {stopping ? (
                  <Loader2 size={14} strokeWidth={1.9} className="animate-spin" />
                ) : (
                  <Power size={14} strokeWidth={1.9} />
                )}
                {stopping ? t("Stopping…") : t("Stop relay")}
              </button>
              <button
                onClick={() => update({ togetherRelayUrl: "" })}
                className="h-11 rounded-xl border border-edge px-4 text-[13px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                {t("Forget URL")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => update({ togetherRelayUrl: "" })}
                className="h-11 flex-1 rounded-xl border border-edge text-[13px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                {t("Use a different URL")}
              </button>
              <button
                onClick={() => setShowDeploy(true)}
                className="h-11 flex-1 rounded-xl bg-ink text-[13px] font-medium text-canvas transition-transform hover:scale-[1.01]"
              >
                {t("Deploy mine instead")}
              </button>
            </div>
          )}

          {stopError && (
            <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger">{stopError}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {isTauri ? (
            <button
              onClick={() => setShowDeploy(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-medium text-canvas transition-transform hover:scale-[1.01]"
            >
              <Power size={15} strokeWidth={1.9} />
              {t("Deploy a relay")}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 p-4">
              <div className="flex items-center gap-2">
                <Power size={14} strokeWidth={1.9} className="text-ink-subtle" />
                <span className="text-[13px] font-medium text-ink">
                  {t("Deploy a relay (desktop only)")}
                </span>
              </div>
              <p className="text-[12px] leading-snug text-ink-muted">
                {t(
                  "Relay deployment requires the Cloudflare API, which is unavailable to browser clients. Use the desktop build to deploy a Worker, then enter the resulting URL below.",
                )}
              </p>
            </div>
          )}
          <p className="text-center text-[12px] text-ink-subtle">
            {t("Enter an existing relay URL:")}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDraftUrl();
              }}
              onBlur={commitDraftUrl}
              placeholder="wss://your-relay.workers.dev"
              className="h-11 flex-1 rounded-xl border border-edge bg-canvas px-3.5 text-[13px] text-ink transition-colors focus:border-accent"
            />
            <button
              onClick={commitDraftUrl}
              disabled={!draftUrl.trim()}
              className="h-11 rounded-xl bg-ink px-4 text-[13px] font-medium text-canvas transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
            >
              {t("Save")}
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-subtle">
            {t(
              "Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.",
            )}
          </p>
          <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-3">
            <span className="text-[12px] text-ink-muted">
              {t("Hit your daily quota? Use Harbor's public relay, or host your own.")}
            </span>
            <button
              onClick={() => update({ togetherRelayUrl: HARBOR_PUBLIC_RELAY })}
              className="flex h-9 w-fit items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <Radio size={13} strokeWidth={1.9} />
              {t("Use Harbor's public relay")}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDocs(true)}
        className="flex items-center gap-2 self-start text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 4h10l4 4v12H5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M15 4v4h4M9 12h6M9 16h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t("Documentation: run your own relay")}
      </button>
    </>
  );
}
