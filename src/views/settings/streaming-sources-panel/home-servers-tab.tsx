import {
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "../icons";
import { UiIcon } from "@/components/ui-icon";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { activeProfileId } from "@/lib/active-profile-id";
import {
  mediaServerConnections,
  removeMediaServerConnection,
  saveMediaServerConnection,
  subscribeMediaServerConnections,
  updateMediaServerConnection,
} from "@/lib/media-server/connections";
import { removeMediaServerItems } from "@/lib/media-server/index-store";
import { synchronizeMediaServer } from "@/lib/media-server/sync";
import { discoverAndAuthenticate, discoverExistingConnection } from "@/lib/media-server/discovery";
import type {
  MediaServerConnection,
  MediaServerProvider,
  MediaServerRefreshInterval,
} from "@/lib/media-server/types";
import { MEDIA_SERVER_QUALITIES } from "@/lib/media-server/quality";
import { signInWithPlex } from "@/lib/media-server/plex-auth";
import { useT } from "@/lib/i18n";
import { Dropdown } from "@/components/dropdown";
import { MediaServerBrand, mediaServerProviderName } from "@/components/media-server-brand";
import { openUrl } from "@/lib/window";
import { useMediaServerHealth } from "@/hooks/use-media-server-health";
import { markMediaServerInactive } from "@/lib/media-server/health";
import { advanceFocus, tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { ROW_DESC, ROW_TITLE, RowNote, Section } from "../shared";
import { ROW_ACTION, ROW_ACTION_PRIMARY, SettingRow, SettingsModal } from "../kit";
import { SButton } from "../ui";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const FIELD_BASE =
  "h-11 min-w-0 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const FIELD = `${FIELD_BASE} w-full max-w-[520px]`;

const DROPDOWN_SLOT = "w-[280px] max-w-full";

const TOKEN_HELP_MIN_H = 240;

function FieldBlock({
  label,
  htmlLabel = true,
  children,
}: {
  label: string;
  htmlLabel?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="harbor-settings-label">{label}</span>
      {children}
    </>
  );
  if (!htmlLabel) return <div className="flex flex-col gap-2">{body}</div>;
  return <label className="flex flex-col gap-2">{body}</label>;
}

function BusyButton({
  busy,
  variant = "secondary",
  disabled,
  onClick,
  children,
}: {
  busy: boolean;
  variant?: "secondary" | "primary";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={onClick}
      className={variant === "primary" ? ROW_ACTION_PRIMARY : ROW_ACTION}
    >
      {children}
    </button>
  );
}

export function HomeServersTab() {
  const t = useT();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<MediaServerConnection | null | "new">(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(() => new Set());
  const [removeTarget, setRemoveTarget] = useState<MediaServerConnection | null>(null);
  const addServer = useRef<HTMLSpanElement>(null);
  const connections = useMemo(() => mediaServerConnections(), [revision]);
  const reachability = useMediaServerHealth(connections);
  useEffect(() => subscribeMediaServerConnections(() => setRevision((value) => value + 1)), []);
  const sync = useCallback(
    async (connection: MediaServerConnection) => {
      if (syncingIds.has(connection.id)) return;
      setSyncingIds((current) => new Set(current).add(connection.id));
      try {
        await synchronizeMediaServer(connection);
      } catch (cause) {
        const at = Date.now();
        markMediaServerInactive(connection.id);
        updateMediaServerConnection(connection.id, {
          lastSyncResult: {
            ok: false,
            message: cause instanceof Error ? cause.message : String(cause),
            at,
          },
        });
      } finally {
        setSyncingIds((current) => {
          const next = new Set(current);
          next.delete(connection.id);
          return next;
        });
      }
    },
    [syncingIds],
  );
  return (
    <>
      <Section
        title={t("Home servers")}
        subtitle={t(
          "Connect Jellyfin, Emby, and Plex libraries on this device. Credentials stay in native secret storage. Each server keeps its own refresh schedule, and cached titles stay available while a server is offline.",
        )}
      >
        {connections.flatMap((connection) => {
          const status = !connection.enabled
            ? "inactive"
            : (reachability[connection.id] ?? "checking");
          const statusLabel =
            status === "active"
              ? t("Active")
              : status === "inactive"
                ? t("Not active")
                : t("Checking…");
          const statusDot =
            status === "active"
              ? "bg-success"
              : status === "checking"
                ? "animate-pulse bg-ink-subtle"
                : "bg-edge";
          const syncSummary = connection.lastSyncResult?.ok
            ? connection.lastSyncResult.message
            : null;
          const syncing = syncingIds.has(connection.id);
          return [
            <SettingRow
              key={connection.id}
              wide
              label={
                <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                  <MediaServerBrand provider={connection.provider} name={connection.name} />
                  <span className={`${QUAL} bg-elevated text-ink-subtle`}>
                    {mediaServerProviderName(connection.provider)}
                  </span>
                  <span className={`inline-flex items-center gap-2 ${ROW_DESC}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} />
                    {statusLabel}
                  </span>
                </span>
              }
              desc={
                <>
                  <span className="block">{connection.origin}</span>
                  {syncSummary && (
                    <span className="block">
                      {syncSummary}
                      {connection.lastSyncAt
                        ? ` · ${new Date(connection.lastSyncAt).toLocaleString()}`
                        : ""}
                    </span>
                  )}
                </>
              }
              warn={connection.lastSyncResult?.ok === false ? connection.lastSyncResult.message : undefined}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <BusyButton busy={syncing} onClick={() => void sync(connection)}>
                  {syncing ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <RefreshCw size={18} />
                  )}
                  {t("Sync now")}
                </BusyButton>
                <SButton onClick={() => setEditing(connection)}>
                  <Pencil size={18} />
                  {t("Edit")}
                </SButton>
                <SButton
                  onClick={() =>
                    updateMediaServerConnection(connection.id, { enabled: !connection.enabled })
                  }
                >
                  {connection.enabled ? t("Disable") : t("Enable")}
                </SButton>
                <SButton variant="danger" onClick={() => setRemoveTarget(connection)}>
                  <Trash2 size={18} />
                  {t("Remove")}
                </SButton>
              </div>
            </SettingRow>,
            <SettingRow
              key={`${connection.id}-quality`}
              label={t("Streaming quality")}
              desc={t(
                "Caps what Harbor asks {name} to send. Original streams the file exactly as it is stored.",
                { name: connection.name },
              )}
            >
              <div className={DROPDOWN_SLOT}>
                <Dropdown
                  size="md"
                  value={connection.preferredQuality}
                  onChange={(value) =>
                    updateMediaServerConnection(connection.id, {
                      preferredQuality: value as MediaServerConnection["preferredQuality"],
                    })
                  }
                  options={MEDIA_SERVER_QUALITIES.map((quality) => ({
                    value: quality.id,
                    label: t(quality.label),
                  }))}
                />
              </div>
            </SettingRow>,
            <SettingRow
              key={`${connection.id}-refresh`}
              label={t("Refresh this library")}
              desc={t(
                "How often Harbor re-reads the library index from {name}. Manual only refreshes when you press Sync now.",
                { name: connection.name },
              )}
            >
              <div className={DROPDOWN_SLOT}>
                <Dropdown
                  size="md"
                  value={connection.refreshInterval}
                  onChange={(value) =>
                    updateMediaServerConnection(connection.id, {
                      refreshInterval: value as MediaServerRefreshInterval,
                    })
                  }
                  options={[
                    { value: "launch", label: t("Every launch") },
                    { value: "custom", label: t("Every…") },
                    { value: "manual", label: t("Manual") },
                  ]}
                />
              </div>
            </SettingRow>,
            ...(connection.refreshInterval === "custom"
              ? [
                  <SettingRow
                    key={`${connection.id}-days`}
                    label={t("Refresh every")}
                    desc={t("Days to wait between automatic refreshes of this library.")}
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshDaysField
                        value={connection.refreshEveryDays ?? 1}
                        onChange={(days) =>
                          updateMediaServerConnection(connection.id, {
                            refreshEveryDays: days,
                          })
                        }
                      />
                      <span className={ROW_DESC}>{t("days")}</span>
                    </div>
                  </SettingRow>,
                ]
              : []),
          ];
        })}
        <SettingRow
          label={
            connections.length === 0 ? t("No home servers connected") : t("Add another home server")
          }
          desc={t("Add as many Jellyfin, Emby, or Plex servers as you use.")}
        >
          <span ref={addServer} className="contents">
            <SButton variant="primary" onClick={() => setEditing("new")}>
              <Plus size={18} />
              {t("Connect server")}
            </SButton>
          </span>
        </SettingRow>
      </Section>
      {editing != null && (
        <ConnectionEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={(connection) => {
            setEditing(null);
            void sync(connection);
          }}
        />
      )}
      {removeTarget && (
        <HomeServerRemoveDialog
          connection={removeTarget}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={async () => {
            const target = removeTarget;
            const active = document.activeElement;
            const ring = active instanceof HTMLElement && navOwnsFocus(active);
            setRemoveTarget(null);
            removeMediaServerConnection(target.id);
            try {
              await removeMediaServerItems(target.id);
            } finally {
              const to = addServer.current?.querySelector("button");
              if (ring && to) tvFocus(to);
            }
          }}
        />
      )}
    </>
  );
}

function RefreshDaysField({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = draft.trim() && Number.isFinite(parsed)
      ? Math.min(365, Math.max(1, Math.round(parsed)))
      : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <input
      aria-label={t("Refresh interval in days")}
      type="number"
      min={1}
      max={365}
      step={1}
      className={`${FIELD_BASE} w-[96px] px-3 text-center tabular-nums`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

function HomeServerRemoveDialog({
  connection,
  onCancel,
  onConfirm,
}: {
  connection: MediaServerConnection;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <SettingsModal
      open
      onClose={onCancel}
      width={520}
      title={t("Remove {name}?", { name: connection.name })}
      sub={t(
        "Cached titles from this server will also be removed. Your media on the server will not be changed.",
      )}
      actions={
        <>
          <SButton onClick={onCancel}>{t("Cancel")}</SButton>
          <SButton variant="danger" onClick={onConfirm}>
            {t("Remove server")}
          </SButton>
        </>
      }
    >
      <div className={`flex flex-wrap items-center gap-2.5 ${ROW_TITLE}`}>
        <MediaServerBrand provider={connection.provider} name={connection.name} />
        <span className={`${QUAL} bg-elevated text-ink-subtle`}>
          {mediaServerProviderName(connection.provider)}
        </span>
      </div>
      <p className={`max-w-[70ch] ${ROW_DESC}`}>{connection.origin}</p>
    </SettingsModal>
  );
}

function TokenHelpButton({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const anchor = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const place = (x?: number, y?: number) => {
    const rect = anchor.current?.getBoundingClientRect();
    const point = x != null && y != null ? { x, y } : pointer.current;
    if (!rect && !point) return;
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, (point?.x ?? rect!.left) - width / 2),
      window.innerWidth - width - 12,
    );
    const anchorY = point?.y ?? rect!.top;
    const below = anchorY - 12 < TOKEN_HELP_MIN_H;
    setBox({ top: below ? anchorY + 20 : Math.max(12, anchorY - 12), left, below });
  };
  const dismissed = useRef(false);
  const cancelHide = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = (event?: ReactMouseEvent) => {
    if (dismissed.current) return;
    cancelHide();
    if (event) {
      pointer.current = { x: event.clientX, y: event.clientY };
      place(event.clientX, event.clientY);
    } else place();
    setOpen(true);
  };
  const hideSoon = () => {
    cancelHide();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };
  useEffect(
    () => () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    const update = () => place();
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isBackKey(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      const active = document.activeElement;
      const trigger = anchor.current;
      if (trigger && active instanceof HTMLElement && active.closest("[data-plex-token-help]")) {
        dismissed.current = true;
        advanceFocus(trigger);
        dismissed.current = false;
      }
      cancelHide();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);
  const host = anchor.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={t("How to find a Plex access token")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onFocus={() => show()}
        onBlur={hideSoon}
        onMouseEnter={(event) => show(event)}
        onMouseMove={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
        }}
        onMouseLeave={hideSoon}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <UiIcon name="help" className="h-5 w-5" />
      </button>
      {open &&
        box &&
        createPortal(
          <div
            data-plex-token-help
            role="tooltip"
            tabIndex={-1}
            onFocus={cancelHide}
            onBlur={hideSoon}
            onMouseEnter={() => show()}
            onMouseLeave={hideSoon}
            style={{
              position: "fixed",
              left: box.left,
              width: Math.min(340, window.innerWidth - 24),
              ...(box.below
                ? { top: box.top, maxHeight: Math.max(120, window.innerHeight - box.top - 12) }
                : { bottom: Math.max(12, window.innerHeight - box.top) }),
            }}
            className={`z-[10000] overflow-y-auto animate-menu-in rounded-[10px] bg-elevated p-4 text-[15.5px] leading-[22px] text-ink-muted ring-1 ring-edge ${
              box.below ? "origin-top" : "origin-bottom"
            }`}
          >
            <ol className="list-decimal space-y-1 ps-5">
              <li>{t("Sign in to Plex Web.")}</li>
              <li>{t("Open a library item and view its XML.")}</li>
              <li>{t("Copy the X-Plex-Token value from the XML page URL.")}</li>
            </ol>
            <p className="mt-2.5">
              {t("This token can be temporary. Sign in with Plex is recommended.")}
            </p>
            <button
              type="button"
              className="mt-2.5 flex h-11 items-center text-[15.5px] text-accent underline underline-offset-4"
              onClick={() =>
                openUrl(
                  "https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/",
                )
              }
            >
              {t("Official Plex token instructions")}
            </button>
          </div>,
          host,
        )}
    </>
  );
}

function ConnectionEditor({
  value,
  onClose,
  onSaved,
}: {
  value: MediaServerConnection | "new";
  onClose: () => void;
  onSaved: (connection: MediaServerConnection) => void;
}) {
  const t = useT();
  const existing = value !== "new" ? value : null;
  const [provider, setProvider] = useState<MediaServerProvider>(existing?.provider ?? "jellyfin");
  const [origin, setOrigin] = useState(existing?.origin ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [tokenHelp, setTokenHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plexStatus, setPlexStatus] = useState<"idle" | "opening" | "waiting" | "ready">("idle");
  const plexAbort = useRef<AbortController | null>(null);
  const connectionAbort = useRef<AbortController | null>(null);
  const profileId = useRef(activeProfileId());
  const close = () => {
    connectionAbort.current?.abort();
    plexAbort.current?.abort();
    onClose();
  };
  useEffect(() => () => {
    connectionAbort.current?.abort();
    plexAbort.current?.abort();
  }, []);
  useEffect(() => {
    setProvider(existing?.provider ?? "jellyfin");
    setOrigin(existing?.origin ?? "");
    setName(existing?.name ?? "");
    setUsername("");
    setPassword("");
    setToken("");
    setError("");
  }, [existing, value]);
  const save = async () => {
    if (connectionAbort.current || !origin.trim()) return;
    const abort = new AbortController();
    connectionAbort.current = abort;
    setBusy(true);
    setError("");
    try {
      let connection: MediaServerConnection;
      let secret: string | undefined;
      if (existing) {
        const discoveredOrigin = await discoverExistingConnection(existing, origin, abort.signal);
        connection = { ...existing, origin: discoveredOrigin, name: name.trim() || existing.name };
      } else {
        const found = await discoverAndAuthenticate(
          provider,
          origin,
          provider === "plex" ? { token } : { username, password },
          abort.signal,
        );
        const auth = found.auth;
        secret = auth.token;
        connection = {
          id: crypto.randomUUID(),
          profileId: profileId.current,
          provider,
          name: name.trim() || auth.userName || provider,
          origin: found.origin,
          userId: auth.userId,
          enabled: true,
          readProgress: true,
          writeProgress: true,
          fanOut: true,
          includeContinueWatching: true,
          directPlay: true,
          transcodeFallback: true,
          preferredQuality: "original",
          priority: mediaServerConnections().length,
          createdAt: Date.now(),
          refreshInterval: "launch",
        };
      }
      if (abort.signal.aborted || profileId.current !== activeProfileId()) return;
      saveMediaServerConnection(connection, secret);
      onSaved(connection);
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (connectionAbort.current === abort) {
        connectionAbort.current = null;
        if (!abort.signal.aborted) setBusy(false);
      }
    }
  };
  const addressHint =
    provider === "plex"
      ? "plex.local:32400"
      : provider === "emby"
        ? "emby.local:8096"
        : "home.local:8096";
  const browserSignIn = async () => {
    if (plexStatus === "opening" || plexStatus === "waiting") return;
    plexAbort.current?.abort();
    const abort = new AbortController();
    plexAbort.current = abort;
    setError("");
    setPlexStatus("opening");
    try {
      const servers = await signInWithPlex(abort.signal, () => {
        if (!abort.signal.aborted) setPlexStatus("waiting");
      });
      if (abort.signal.aborted || plexAbort.current !== abort) return;
      const credential = servers.find((server) => server.available)?.token ?? servers[0]?.token;
      if (credential) setToken(credential);
      setPlexStatus("ready");
      if (!credential)
        setError(t("Plex sign-in succeeded, but no server credential was returned."));
    } catch (cause) {
      if (abort.signal.aborted || plexAbort.current !== abort) return;
      if ((cause as Error).name !== "AbortError")
        setError(cause instanceof Error ? cause.message : String(cause));
      setPlexStatus("idle");
    }
  };
  return (
    <SettingsModal
      open
      onClose={close}
      width={640}
      title={existing ? t("Edit home server") : t("Connect home server")}
      sub={t(
        "Harbor tries HTTP, HTTPS, reverse proxies, and the provider's default port. Credentials are stored separately.",
      )}
      actions={
        <>
          <SButton onClick={close}>{t("Cancel")}</SButton>
          <BusyButton
            variant="primary"
            busy={busy}
            disabled={!origin.trim() || (!existing && provider === "plex" && !token)}
            onClick={() => void save()}
          >
            {busy ? t("Connecting…") : existing ? t("Save and sync") : t("Connect and sync")}
          </BusyButton>
        </>
      }
    >
      {!existing && (
        <FieldBlock label={t("Provider")} htmlLabel={false}>
          <div className="w-full max-w-[420px]">
            <select
              aria-label={t("Provider")}
              className={`${FIELD} appearance-auto`}
              disabled={busy}
              value={provider}
              onChange={(event) => {
                plexAbort.current?.abort();
                setProvider(event.target.value as MediaServerProvider);
                setUsername("");
                setPassword("");
                setToken("");
                setTokenHelp(false);
                setPlexStatus("idle");
                setError("");
              }}
            >
              <option value="jellyfin">Jellyfin</option>
              <option value="emby">Emby</option>
              <option value="plex">Plex</option>
            </select>
          </div>
        </FieldBlock>
      )}
      {!existing && provider === "plex" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className={ROW_TITLE}>{t("Recommended: sign in with Plex")}</p>
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t(
                "Harbor opens Plex in your browser. Your Plex password is never entered in Harbor.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <BusyButton
              busy={plexStatus === "opening" || plexStatus === "waiting"}
              disabled={busy}
              onClick={() => void browserSignIn()}
            >
              {plexStatus === "opening"
                ? t("Opening browser…")
                : plexStatus === "waiting"
                  ? t("Waiting for Plex…")
                  : plexStatus === "ready"
                    ? t("Sign in again")
                    : t("Sign in with Plex")}
            </BusyButton>
            {plexStatus === "waiting" && (
              <SButton
                onClick={() => {
                  plexAbort.current?.abort();
                  setPlexStatus("idle");
                }}
              >
                {t("Cancel")}
              </SButton>
            )}
            {plexStatus === "ready" && (
              <span className="text-[15.5px] font-medium leading-[22px] text-accent">
                {t("Signed in. Enter your server address below.")}
              </span>
            )}
          </div>
        </div>
      )}
      <FieldBlock label={t("Server address")}>
        <input
          placeholder={addressHint}
          className={FIELD}
          value={origin}
          readOnly={busy}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setOrigin(event.target.value)}
        />
      </FieldBlock>
      <FieldBlock label={t("Display name")}>
        <input
          placeholder={mediaServerProviderName(provider)}
          className={FIELD}
          value={name}
          readOnly={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </FieldBlock>
      {!existing &&
        (provider === "plex" ? (
          <div className="flex flex-col gap-3">
            <p className={ROW_TITLE}>{t("Advanced: use an access token")}</p>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1">
                <span className="harbor-settings-label">{t("Plex access token")}</span>
                <TokenHelpButton open={tokenHelp} setOpen={setTokenHelp} />
              </span>
              <input
                aria-label={t("Plex access token")}
                placeholder={t("Paste your Plex token")}
                type="password"
                className={FIELD}
                value={token}
                readOnly={busy}
                autoComplete="off"
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <>
            <FieldBlock label={t("Username")}>
              <input
                placeholder={t("Server username")}
                className={FIELD}
                value={username}
                readOnly={busy}
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock label={t("Password")}>
              <input
                placeholder={t("Server password")}
                type="password"
                className={FIELD}
                value={password}
                readOnly={busy}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </FieldBlock>
          </>
        ))}
      {error && <RowNote>{error}</RowNote>}
    </SettingsModal>
  );
}
