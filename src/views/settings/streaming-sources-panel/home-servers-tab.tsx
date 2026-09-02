import { CircleHelp, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
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
import { MediaServerBrand } from "@/components/media-server-brand";
import { openUrl } from "@/lib/window";
import { useMediaServerHealth } from "@/hooks/use-media-server-health";
import { markMediaServerInactive } from "@/lib/media-server/health";
import { Section } from "../shared";
import { SettingGroup, SettingRow } from "../kit";

const inputClass =
  "h-9 w-full rounded-md bg-canvas px-3 text-[12.5px] text-ink ring-1 ring-edge-soft outline-none focus:ring-edge";
const actionClass =
  "rounded-md bg-canvas px-3 py-2 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50";

export function HomeServersTab() {
  const t = useT();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<MediaServerConnection | null | "new">(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(() => new Set());
  const [removeTarget, setRemoveTarget] = useState<MediaServerConnection | null>(null);
  const connections = useMemo(() => mediaServerConnections(), [revision]);
  const reachability = useMediaServerHealth(connections);
  useEffect(() => subscribeMediaServerConnections(() => setRevision((value) => value + 1)), []);
  const sync = useCallback(async (connection: MediaServerConnection) => {
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
  }, []);
  return (
    <>
      <Section
        title={t("Home servers")}
        subtitle={t(
          "Connect Jellyfin, Emby, and Plex libraries on this device. Credentials stay in native secret storage.",
        )}
      >
        <SettingGroup label={t("Refresh policy")}>
          <SettingRow
            label={t("Automatic refresh")}
            desc={t(
              "Applied separately to each connection. Cached titles remain available when a server is offline.",
            )}
          >
            <span className="text-[12px] text-ink-subtle">{t("Set per server below")}</span>
          </SettingRow>
        </SettingGroup>
        <SettingGroup label={t("Connections")}>
          {connections.map((connection) => {
            const status = !connection.enabled
              ? "inactive"
              : (reachability[connection.id] ?? "checking");
            const statusLabel =
              status === "active"
                ? t("Active")
                : status === "inactive"
                  ? t("Not active")
                  : t("Checking…");
            const syncSummary = connection.lastSyncResult?.ok
              ? connection.lastSyncResult.message
              : null;
            return (
              <div key={connection.id} className="relative">
                <span
                  className="group absolute end-3.5 top-3.5 z-10 inline-flex h-4 w-4 items-center justify-center"
                  aria-label={statusLabel}
                  tabIndex={0}
                >
                  <span
                    className={`h-3 w-3 rounded-full transition-colors ${status === "active" ? "bg-accent" : status === "checking" ? "animate-pulse bg-ink-subtle" : "border-2 border-ink-subtle bg-transparent"}`}
                  />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute end-0 top-6 w-max translate-y-1 rounded-lg bg-elevated px-2.5 py-1.5 text-[11.5px] font-medium text-ink opacity-0 shadow-[0_12px_35px_rgba(0,0,0,.5)] ring-1 ring-edge transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100"
                  >
                    {statusLabel}
                  </span>
                </span>
                <SettingRow
                  wide
                  label={
                    <span className="flex items-center gap-2">
                      <MediaServerBrand provider={connection.provider} name={connection.name} />
                      <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] uppercase text-ink-subtle">
                        {connection.provider}
                      </span>
                    </span>
                  }
                  desc={
                    <>
                      <span>{connection.origin}</span>
                      {syncSummary && (
                        <>
                          <br />
                          <span>
                            {syncSummary}
                            {connection.lastSyncAt
                              ? ` · ${new Date(connection.lastSyncAt).toLocaleString()}`
                              : ""}
                          </span>
                        </>
                      )}
                    </>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                      <span>{t("Quality")}</span>
                      <Dropdown
                        size="sm"
                        className="w-44"
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
                    </label>
                    <Dropdown
                      size="sm"
                      className="min-w-48 flex-1"
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
                    {connection.refreshInterval === "custom" && (
                      <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                        <input
                          aria-label={t("Refresh interval in days")}
                          type="number"
                          min={1}
                          max={365}
                          className={`${inputClass} w-20`}
                          value={connection.refreshEveryDays ?? 1}
                          onChange={(event) =>
                            updateMediaServerConnection(connection.id, {
                              refreshEveryDays: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                        />
                        {t("days")}
                      </label>
                    )}
                    <button
                      className={actionClass}
                      disabled={syncingIds.has(connection.id)}
                      onClick={() => void sync(connection)}
                    >
                      {syncingIds.has(connection.id) ? (
                        <LoaderCircle className="inline animate-spin" size={13} />
                      ) : (
                        <RefreshCw className="inline" size={13} />
                      )}{" "}
                      {t("Sync now")}
                    </button>
                    <button className={actionClass} onClick={() => setEditing(connection)}>
                      <Pencil className="inline" size={13} /> {t("Edit")}
                    </button>
                    <button
                      className={actionClass}
                      onClick={() =>
                        updateMediaServerConnection(connection.id, { enabled: !connection.enabled })
                      }
                    >
                      {connection.enabled ? t("Disable") : t("Enable")}
                    </button>
                    <button
                      className={`${actionClass} text-danger`}
                      onClick={() => setRemoveTarget(connection)}
                    >
                      <Trash2 className="inline" size={13} /> {t("Remove")}
                    </button>
                  </div>
                </SettingRow>
              </div>
            );
          })}
          {connections.length === 0 && (
            <SettingRow
              wide
              label={t("No home servers connected")}
              desc={t("Add as many Jellyfin, Emby, or Plex servers as you use.")}
            />
          )}
        </SettingGroup>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="mt-2 inline-flex h-9 w-fit items-center gap-2 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas"
        >
          <Plus size={14} />
          {t("Connect server")}
        </button>
      </Section>
      {editing != null && <ConnectionEditor value={editing} onClose={() => setEditing(null)} />}
      {removeTarget && (
        <HomeServerRemoveDialog
          connection={removeTarget}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={async () => {
            const target = removeTarget;
            setRemoveTarget(null);
            removeMediaServerConnection(target.id);
            await removeMediaServerItems(target.id);
          }}
        />
      )}
    </>
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel, onConfirm]);
  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[10000] grid place-items-center bg-black/65 p-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-server-title"
        className="w-full max-w-md animate-menu-in rounded-2xl bg-elevated p-5 text-ink shadow-[0_28px_90px_rgba(0,0,0,.65)] ring-1 ring-edge"
      >
        <div className="flex items-start gap-3">
          <MediaServerBrand provider={connection.provider} name={connection.name} />
          <button
            aria-label={t("Cancel")}
            onClick={onCancel}
            className="ms-auto rounded-md p-1 text-ink-subtle hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <h3 id="remove-server-title" className="mt-5 text-[17px] font-semibold">
          {t("Remove {name}?", { name: connection.name })}
        </h3>
        <p className="mt-2 text-[13px] leading-5 text-ink-muted">
          {t(
            "Cached titles from this server will also be removed. Your media on the server will not be changed.",
          )}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className={actionClass} onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button
            autoFocus
            className="rounded-md bg-danger px-4 py-2 text-[12px] font-semibold text-white"
            onClick={onConfirm}
          >
            {t("Remove server")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TokenHelpButton({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const anchor = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const place = (x?: number, y?: number) => {
    const rect = anchor.current?.getBoundingClientRect();
    const point = x != null && y != null ? { x, y } : pointer.current;
    if (!rect && !point) return;
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, (point?.x ?? rect!.left) - width / 2),
      window.innerWidth - width - 12,
    );
    const desiredTop = (point?.y ?? rect!.top) - 12;
    setBox({ top: Math.max(12, desiredTop), left });
  };
  const show = (event?: ReactMouseEvent) => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (event) {
      pointer.current = { x: event.clientX, y: event.clientY };
      place(event.clientX, event.clientY);
    } else place();
    setOpen(true);
  };
  const hideSoon = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
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
        className="rounded-full text-ink-subtle transition-colors hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <CircleHelp size={15} />
      </button>
      {open &&
        box &&
        createPortal(
          <div
            data-plex-token-help
            role="tooltip"
            tabIndex={-1}
            onFocus={() => show()}
            onBlur={hideSoon}
            onMouseEnter={() => show()}
            onMouseLeave={hideSoon}
            style={{
              position: "fixed",
              left: box.left,
              bottom: Math.max(12, window.innerHeight - box.top),
              width: Math.min(340, window.innerWidth - 24),
            }}
            className="z-[10000] origin-bottom animate-menu-in rounded-xl bg-elevated p-4 text-[12px] leading-5 text-ink-muted shadow-[0_18px_55px_rgba(0,0,0,.6)] ring-1 ring-edge"
          >
            <ol className="list-decimal ps-4">
              <li>{t("Sign in to Plex Web.")}</li>
              <li>{t("Open a library item and view its XML.")}</li>
              <li>{t("Copy the X-Plex-Token value from the XML page URL.")}</li>
            </ol>
            <p className="mt-2">
              {t("This token can be temporary. Sign in with Plex is recommended.")}
            </p>
            <button
              className="mt-2 text-accent underline"
              onClick={() =>
                openUrl(
                  "https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/",
                )
              }
            >
              {t("Official Plex token instructions")}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function ConnectionEditor({
  value,
  onClose,
}: {
  value: MediaServerConnection | "new";
  onClose: () => void;
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
    setBusy(true);
    setError("");
    try {
      let connection: MediaServerConnection;
      let secret: string | undefined;
      if (existing) {
        const discoveredOrigin = await discoverExistingConnection(existing, origin);
        connection = { ...existing, origin: discoveredOrigin, name: name.trim() || existing.name };
      } else {
        const found = await discoverAndAuthenticate(
          provider,
          origin,
          provider === "plex" ? { token } : { username, password },
        );
        const auth = found.auth;
        secret = auth.token;
        connection = {
          id: crypto.randomUUID(),
          profileId: activeProfileId(),
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
      saveMediaServerConnection(connection, secret);
      await synchronizeMediaServer(connection);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const addressHint =
    provider === "plex"
      ? "plex.local or 192.168.1.20:32400"
      : provider === "emby"
        ? "emby.local or 192.168.1.20:8096"
        : "home.local or 192.168.1.20:8096";
  const browserSignIn = async () => {
    plexAbort.current?.abort();
    const abort = new AbortController();
    plexAbort.current = abort;
    setError("");
    setPlexStatus("opening");
    try {
      const servers = await signInWithPlex(abort.signal, () => setPlexStatus("waiting"));
      const credential = servers.find((server) => server.available)?.token ?? servers[0]?.token;
      if (credential) setToken(credential);
      setPlexStatus("ready");
      if (!credential)
        setError(t("Plex sign-in succeeded, but no server credential was returned."));
    } catch (cause) {
      if ((cause as Error).name !== "AbortError")
        setError(cause instanceof Error ? cause.message : String(cause));
      setPlexStatus("idle");
    }
  };
  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-edge-soft bg-raised/40 p-4">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">
          {existing ? t("Edit home server") : t("Connect home server")}
        </h3>
        <p className="text-[12px] text-ink-muted">
          {t(
            "Harbor tries HTTP, HTTPS, reverse proxies, and the provider’s default port. Credentials are stored separately.",
          )}
        </p>
      </div>
      {!existing && (
        <label className="grid gap-1 text-[12px] text-ink-muted">
          {t("Provider")}
          <Dropdown
            value={provider}
            onChange={(value) => setProvider(value as MediaServerProvider)}
            options={[
              { value: "jellyfin", label: "Jellyfin" },
              { value: "emby", label: "Emby" },
              { value: "plex", label: "Plex" },
            ]}
          />
        </label>
      )}
      {!existing && provider === "plex" && (
        <div className="grid gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
          <div>
            <p className="text-[12.5px] font-semibold text-ink">
              {t("Sign in with Plex — Recommended")}
            </p>
            <p className="text-[12px] text-ink-muted">
              {t(
                "Harbor opens Plex in your browser. Your Plex password is never entered in Harbor.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={plexStatus === "opening" || plexStatus === "waiting"}
              onClick={() => void browserSignIn()}
              className={actionClass}
            >
              {plexStatus === "opening"
                ? t("Opening browser…")
                : plexStatus === "waiting"
                  ? t("Waiting for Plex…")
                  : plexStatus === "ready"
                    ? t("Sign in again")
                    : t("Sign in with Plex")}
            </button>
            {plexStatus === "waiting" && (
              <button
                type="button"
                className={actionClass}
                onClick={() => {
                  plexAbort.current?.abort();
                  setPlexStatus("idle");
                }}
              >
                {t("Cancel")}
              </button>
            )}
            {plexStatus === "ready" && (
              <span className="text-[12px] font-semibold text-accent">
                {t("Signed in — enter your server address below")}
              </span>
            )}
          </div>
        </div>
      )}
      <label className="grid gap-1 text-[12px] text-ink-muted">
        {t("Server address")}
        <input
          placeholder={addressHint}
          className={inputClass}
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-[12px] text-ink-muted">
        {t("Display name")}
        <input
          placeholder={
            provider === "plex"
              ? "Living room Plex"
              : provider === "emby"
                ? "Home Emby"
                : "Home Jellyfin"
          }
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {!existing &&
        (provider === "plex" ? (
          <div className="grid gap-2 rounded-lg border border-edge-soft p-3">
            <p className="text-[12.5px] font-semibold text-ink">
              {t("Use access token — Advanced")}
            </p>
            <label className="grid gap-1 text-[12px] text-ink-muted">
              <span className="flex items-center gap-1">
                {t("Plex access token")}
                <TokenHelpButton open={tokenHelp} setOpen={setTokenHelp} />
              </span>
              <input
                placeholder={t("Paste your Plex token")}
                type="password"
                className={inputClass}
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
          </div>
        ) : (
          <>
            <label className="grid gap-1 text-[12px] text-ink-muted">
              {t("Username")}
              <input
                placeholder={t("Server username")}
                className={inputClass}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[12px] text-ink-muted">
              {t("Password")}
              <input
                placeholder={t("Server password")}
                type="password"
                className={inputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </>
        ))}
      {error && <p className="rounded-md bg-danger/10 p-3 text-[12px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className={actionClass} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          disabled={busy || !origin.trim() || (!existing && provider === "plex" && !token)}
          onClick={() => void save()}
          className="h-9 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas disabled:opacity-40"
        >
          {busy ? t("Connecting…") : existing ? t("Save and sync") : t("Connect and sync")}
        </button>
      </div>
    </div>
  );
}
