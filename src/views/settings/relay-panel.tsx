import { useSubTabs } from "./sub-tabs";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Power,
  Radio,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useState } from "react";
import cloudflareLogo from "@/assets/cloudflare.webp";
import { deleteRelay } from "@/lib/together/cf-deploy";
import { HARBOR_PUBLIC_RELAY, isPublicRelay } from "@/lib/together/relay-version";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { downloadText } from "@/lib/download-text";
import { ModalButton, SettingGroup, SettingRow, SettingsModal, ROW_ACTION } from "./kit";
import { useRelayHealth, type PassiveRelayHealth } from "./relay-panel/use-relay-health";
import { HoverTooltip } from "@/components/hover-tooltip";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const ROW_ACTION_PRIMARY =
  "harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40";
const ROW_ACTION_DANGER =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-danger/15 px-3.5 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/25 disabled:opacity-50 disabled:hover:bg-danger/25";

function isCloudflareRelay(url: string): boolean {
  return /workers\.dev|cloudflare/i.test(url);
}

type RelayKind = "public" | "cloudflare" | "custom";

type RelayStatus = "checking" | "live" | "stale" | "down" | "idle";

const STATUS_DOT: Record<RelayStatus, string> = {
  checking: "bg-ink-subtle",
  live: "bg-success",
  stale: "bg-accent",
  down: "bg-danger",
  idle: "bg-ink-subtle",
};

function RelayMark({ kind, status }: { kind: RelayKind; status?: RelayStatus }) {
  const t = useT();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-canvas text-ink-muted">
      {kind === "public" ? (
        <BroadcastGlyph status={status ?? "idle"} />
      ) : kind === "cloudflare" ? (
        <img
          src={cloudflareLogo}
          alt={t("Cloudflare")}
          className="h-5 w-5 object-contain"
          draggable={false}
        />
      ) : (
        <Radio size={16} strokeWidth={1.9} />
      )}
    </span>
  );
}

function BroadcastGlyph({ status }: { status: RelayStatus }) {
  const quiet = status === "down" || status === "idle";
  return (
    <span aria-hidden className="relative block h-5 w-5">
      <span
        className={`absolute start-1/2 top-1/2 block h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-300 ${STATUS_DOT[status]}`}
      />
      {[0, 1].map((i) => (
        <span
          key={i}
          className={`absolute start-1/2 top-1/2 block rounded-full border border-current ${quiet ? "" : "harbor-broadcast"}`}
          style={{
            width: 11 + i * 7,
            height: 11 + i * 7,
            marginInlineStart: -(11 + i * 7) / 2,
            marginTop: -(11 + i * 7) / 2,
            animationDelay: `${i * 0.55}s`,
            opacity: quiet ? 0.12 : undefined,
          }}
        />
      ))}
    </span>
  );
}

function PublicRelayMark() {
  const { passive } = useRelayHealth(HARBOR_PUBLIC_RELAY);
  const status: RelayStatus = !passive ? "checking" : passive.reachable ? "live" : "down";
  return <RelayStatusMark kind="public" status={status} passive={passive} />;
}

function RelayStatusMark({
  kind,
  status,
  passive,
}: {
  kind: RelayKind;
  status: RelayStatus;
  passive: PassiveRelayHealth;
}) {
  const t = useT();
  const label =
    status === "live"
      ? t("Connected")
      : status === "stale"
        ? t("Update available")
        : status === "down"
          ? t("Unreachable")
          : t("Checking");
  const detail = [
    passive?.healthMs != null ? t("{n} ms round trip", { n: passive.healthMs }) : null,
    passive?.version != null ? `v${passive.version}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <HoverTooltip
      label={label}
      sublabel={detail || undefined}
      mark={
        <span
          aria-hidden
          className={`block h-[6px] w-[6px] shrink-0 rounded-full ${STATUS_DOT[status]}`}
        />
      }
      side="top"
      align="center"
      arrow
    >
      <RelayMark kind={kind} status={status} />
    </HoverTooltip>
  );
}

type Tab = "status" | "manage";

export function TogetherRelayPanel({
  onOpenDocs,
  onOpenDeploy,
}: {
  onOpenDocs: () => void;
  onOpenDeploy: () => void;
}) {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>("status");
  const t = useT();
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { testing, testResult, runTest, passive } = useRelayHealth(settings.togetherRelayUrl);
  const [draftUrl, setDraftUrl] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);

  const hasUrl = !!settings.togetherRelayUrl;
  const isCfRelay = isCloudflareRelay(settings.togetherRelayUrl);
  const isPubRelay = hasUrl && isPublicRelay(settings.togetherRelayUrl);
  const kind: RelayKind = isPubRelay ? "public" : isCfRelay ? "cloudflare" : "custom";
  const relayStatus: RelayStatus = !hasUrl
    ? "idle"
    : !passive
      ? "checking"
      : !passive.reachable
        ? "down"
        : passive.needsUpdate
          ? "stale"
          : "live";

  const commitDraftUrl = () => {
    const v = draftUrl.trim();
    if (v) {
      update({ togetherRelayUrl: v });
      setUrlOpen(false);
    }
  };
  const isManaged = settings.togetherCfDeployed && !!settings.togetherCfToken && !!settings.togetherCfAccountId;

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

  const redeploy = () => (isManaged ? onOpenDeploy() : onOpenDocs());

  useSubTabs(
    hasUrl
      ? [
          { id: "status", label: t("Status") },
          { id: "manage", label: t("Manage") },
        ]
      : [],
    tab,
    (id) => setTab(id as Tab),
  );

  if (!hasUrl) {
    return (
      <>
        <SettingGroup label={t("Get a relay")}>
          {isTauri ? (
            <SettingRow
              icon={<Power size={16} strokeWidth={1.9} />}
              label={t("Deploy a relay")}
              desc={t("Harbor creates a Cloudflare Worker on your own free account and saves the URL.")}
              tip={t("Runs on Cloudflare's free Workers tier. Takes about two minutes, and you can stop it from here later.")}
            >
              <button onClick={onOpenDeploy} className={ROW_ACTION_PRIMARY}>
                <Power size={14} strokeWidth={1.9} />
                {t("Deploy")}
              </button>
            </SettingRow>
          ) : (
            <SettingRow
              icon={<Power size={16} strokeWidth={1.9} />}
              label={t("Deploy a relay (desktop only)")}
              lockReason={t("Relay deployment requires the Cloudflare API, which is unavailable to browser clients. Use the desktop build to deploy a Worker, then enter the resulting URL below.")}
            />
          )}

          <SettingRow
            icon={<PublicRelayMark />}
            label={t("Harbor's public relay")}
            desc={t("A relay we run. Nothing to set up, and it stays current on its own.")}
            tip={t("Hit your daily quota? Use Harbor's public relay, or host your own.")}
          >
            <button
              onClick={() => update({ togetherRelayUrl: HARBOR_PUBLIC_RELAY })}
              className={ROW_ACTION}
            >
              <Radio size={14} strokeWidth={1.9} />
              {t("Use Harbor's public relay")}
            </button>
          </SettingRow>

          <SettingRow
            icon={<Link2 size={16} strokeWidth={1.9} />}
            label={t("Use an existing relay")}
            desc={t("Paste a wss:// URL that a friend or your community shared with you.")}
          >
            <button onClick={() => setUrlOpen(true)} className={ROW_ACTION}>
              <Link2 size={14} strokeWidth={1.9} />
              {t("Enter URL")}
            </button>
          </SettingRow>
        </SettingGroup>

      <SettingGroup label={t("Documentation")}>
        <SettingRow
          icon={<FileText size={16} strokeWidth={1.9} />}
          label={t("Documentation: run your own relay")}
          desc={t("Overview, manual wrangler deploy, costs, and troubleshooting.")}
        >
          <button onClick={onOpenDocs} className={ROW_ACTION}>
            <BookOpen size={14} strokeWidth={1.9} />
            {t("Open")}
          </button>
        </SettingRow>
      </SettingGroup>

      <SettingsModal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        title={t("Use an existing relay")}
        sub={t("Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.")}
        actions={<ModalButton onClick={commitDraftUrl}>{t("Save")}</ModalButton>}
      >
        <div className="flex flex-col gap-2 rounded-md bg-elevated px-4 py-3.5">
          <label className="text-[13px] font-medium text-ink" htmlFor="harbor-relay-url">
            {t("Enter an existing relay URL:")}
          </label>
          <input
            id="harbor-relay-url"
            type="text"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraftUrl();
            }}
            onBlur={commitDraftUrl}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="wss://your-relay.workers.dev"
            className="h-11 w-full rounded-md bg-canvas px-3.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-ink-subtle/55 focus:bg-raised"
          />
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t("Use the wss:// scheme, not https://.")}
          </span>
        </div>
      </SettingsModal>
      </>
    );
  }

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "status" && (
        <>
          <SettingGroup label={t("Connection")}>
            <SettingRow
              icon={<RelayStatusMark kind={kind} status={relayStatus} passive={passive} />}
              label={isManaged ? t("Your relay is live") : t("Connected to relay")}
              desc={
                <span
                  className="block truncate font-mono text-[12.5px] text-ink"
                  title={settings.togetherRelayUrl}
                >
                  {settings.togetherRelayUrl}
                </span>
              }
            >
              <button onClick={copy} className={ROW_ACTION}>
                {copied ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={1.8} />}
                {copied ? t("Copied") : t("Copy")}
              </button>
            </SettingRow>

            <SettingRow
              label={t("Watch Together")}
              desc={t("Synchronizes playback state between participants in the same room.")}
              tip={t("Rooms are created on demand and disappear when the last person leaves.")}
            >
              <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                {t("Active")}
              </span>
            </SettingRow>
          </SettingGroup>

          <SettingGroup label={t("Health")}>
            {passive && (
              <SettingRow
                icon={
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      passive.needsUpdate ? "bg-accent-soft text-accent" : "bg-success/15 text-success"
                    }`}
                  >
                    <ShieldCheck size={14} strokeWidth={2} />
                  </span>
                }
                label={
                  passive.needsUpdate
                    ? t("Relay version {version}. Update available.", { version: passive.version ?? t("unknown") })
                    : t("Relay is current (v{version}).", { version: passive.version ?? "" })
                }
                desc={
                  passive.needsUpdate
                    ? isPubRelay
                      ? t("Harbor's public relay updates automatically; nothing to do.")
                      : t("Redeploy to pick up the latest Watch Together fixes. The in-app banner clears once the new version is live.")
                    : t("Running the latest Watch Together protocol.")
                }
              >
                {passive.needsUpdate && !isPubRelay && (
                  <button onClick={redeploy} className={ROW_ACTION}>
                    {isManaged ? <Power size={14} strokeWidth={2} /> : <BookOpen size={14} strokeWidth={1.9} />}
                    {isManaged ? t("Redeploy") : t("Redeploy instructions")}
                  </button>
                )}
              </SettingRow>
            )}

            <SettingRow
              label={t("Test connection")}
              desc={t("Pings your Worker at /health to confirm it's reachable from this device.")}
              tip={t("A passing test means Watch Together rooms will connect from this machine.")}
            >
              <button onClick={runTest} disabled={testing} className={ROW_ACTION}>
                {testing ? (
                  <Loader2 size={14} strokeWidth={1.9} className="animate-spin" />
                ) : (
                  <Wifi size={14} strokeWidth={1.9} />
                )}
                {testing ? t("Testing…") : t("Run test")}
              </button>
            </SettingRow>

            {testResult && (
              <div className="flex flex-col gap-2.5 rounded-md bg-elevated px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      testResult.ok ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {testResult.ok ? <Check size={14} strokeWidth={2.4} /> : <X size={14} strokeWidth={2.4} />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`text-[12.5px] font-medium ${testResult.ok ? "text-ink" : "text-danger"}`}
                    >
                      {testResult.ok ? t("Relay verified end-to-end") : t("Relay test failed")}
                    </span>
                    <span className="break-words text-[12.5px] leading-relaxed text-ink-subtle">
                      {testResult.message}
                    </span>
                  </div>
                </div>
                {testResult.needsUpdate && !isPubRelay && (
                  <button onClick={redeploy} className={`${ROW_ACTION_PRIMARY} ms-9 w-fit`}>
                    <Power size={12} strokeWidth={2} />
                    {isManaged ? t("Redeploy relay") : t("Redeploy instructions")}
                  </button>
                )}
              </div>
            )}
          </SettingGroup>
        </>
      )}
      {tab === "manage" && (
        <>
          <SettingGroup label={t("Manage")}>
            {isManaged ? (
              <>
                <SettingRow
                  icon={<Download size={16} strokeWidth={1.9} />}
                  label={t("Backup credentials")}
                  desc={t("Saves the relay URL and your Cloudflare token to a file.")}
                  tip={t("Cloudflare shows API tokens only once. Save a copy now or you'll lose the ability to stop or redeploy this relay from Harbor.")}
                >
                  <button onClick={exportBackup} className={ROW_ACTION}>
                    <Download size={14} strokeWidth={1.9} />
                    {t("Export")}
                  </button>
                </SettingRow>

                <SettingRow
                  icon={<Link2 size={16} strokeWidth={1.9} />}
                  label={t("Forget URL")}
                  desc={t("Clears the URL from Harbor. The Worker keeps running on Cloudflare.")}
                >
                  <button onClick={() => update({ togetherRelayUrl: "" })} className={ROW_ACTION}>
                    {t("Forget")}
                  </button>
                </SettingRow>

                <SettingRow
                  icon={<Trash2 size={16} strokeWidth={1.9} />}
                  label={t("Stop relay")}
                  desc={t("Deletes the Worker from your Cloudflare account. Rooms in progress end immediately.")}
                  warn={stopError ?? undefined}
                >
                  <button onClick={stop} disabled={stopping} className={ROW_ACTION_DANGER}>
                    {stopping ? (
                      <Loader2 size={14} strokeWidth={1.9} className="animate-spin" />
                    ) : (
                      <Power size={14} strokeWidth={1.9} />
                    )}
                    {stopping ? t("Stopping…") : t("Stop")}
                  </button>
                </SettingRow>
              </>
            ) : (
              <>
                <SettingRow
                  icon={<Link2 size={16} strokeWidth={1.9} />}
                  label={t("Use a different URL")}
                  desc={t("Clears the saved URL so you can point Harbor at another relay.")}
                >
                  <button onClick={() => update({ togetherRelayUrl: "" })} className={ROW_ACTION}>
                    {t("Change")}
                  </button>
                </SettingRow>

                <SettingRow
                  icon={<Power size={16} strokeWidth={1.9} />}
                  label={t("Deploy mine instead")}
                  desc={t("Set up your own Cloudflare Worker rather than borrowing this one.")}
                >
                  <button onClick={onOpenDeploy} className={ROW_ACTION}>
                    <Power size={14} strokeWidth={1.9} />
                    {t("Deploy")}
                  </button>
                </SettingRow>
              </>
            )}
          </SettingGroup>

      <SettingGroup label={t("Documentation")}>
        <SettingRow
          icon={<FileText size={16} strokeWidth={1.9} />}
          label={t("Documentation: run your own relay")}
          desc={t("Overview, manual wrangler deploy, costs, and troubleshooting.")}
        >
          <button onClick={onOpenDocs} className={ROW_ACTION}>
            <BookOpen size={14} strokeWidth={1.9} />
            {t("Open")}
          </button>
        </SettingRow>
      </SettingGroup>

      <SettingsModal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        title={t("Use an existing relay")}
        sub={t("Only enter URLs for relays you operate or trust. A relay only carries Watch Together sync messages (play, pause, seek). Nothing else passes through it.")}
        actions={<ModalButton onClick={commitDraftUrl}>{t("Save")}</ModalButton>}
      >
        <div className="flex flex-col gap-2 rounded-md bg-elevated px-4 py-3.5">
          <label className="text-[13px] font-medium text-ink" htmlFor="harbor-relay-url">
            {t("Enter an existing relay URL:")}
          </label>
          <input
            id="harbor-relay-url"
            type="text"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraftUrl();
            }}
            onBlur={commitDraftUrl}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="wss://your-relay.workers.dev"
            className="h-11 w-full rounded-md bg-canvas px-3.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-ink-subtle/55 focus:bg-raised"
          />
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t("Use the wss:// scheme, not https://.")}
          </span>
        </div>
      </SettingsModal>
        </>
      )}
    </div>
  );
}
