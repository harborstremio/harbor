import { useId, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  FolderOpen,
  HardDrive,
  Library,
  LoaderCircle,
  Radio,
  Server,
  type MusicIconComponent,
} from "@/components/icons/music-icons";
import { MusicServiceLogo } from "../music-service-logo";
import { SpotifyPlaybackTarget } from "./spotify-devices";
import { SpotifySetupFields } from "./spotify-setup";
import { MusicLastFm } from "@/components/music/music-lastfm";
import { useT } from "@/lib/i18n";
import "@/components/music/music-connect-field.css";
import { connectSource, disconnectSource, scanLocalFolder } from "@/lib/music/catalog";
import {
  isGatedMusicSource,
  type GatedMusicSource,
  musicSourceAllowed,
  useMusicSourceConsent,
  requestMusicSourceConsent,
  setMusicSourceEnabled,
} from "@/lib/music/source-consent";
import { spotifySetupErrorKey } from "@/lib/music/spotify-setup";
import type {
  MusicConnection,
  MusicConnectionField,
  MusicConnectionKind,
  MusicConnectionStatus,
} from "@/lib/music/types";

export function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export const PRIMARY_BUTTON =
  "inline-flex h-11 min-w-28 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas disabled:opacity-40";

export const SECONDARY_BUTTON =
  "inline-flex h-11 items-center gap-2 rounded-full border border-edge px-4 text-[12px] font-medium text-ink transition-colors duration-200 ease-out hover:bg-elevated disabled:opacity-40";

const KIND_ICON: Record<MusicConnectionKind, MusicIconComponent> = {
  streaming: AudioLines,
  server: Server,
  local: HardDrive,
  scrobbler: Radio,
  catalog: Library,
};

const STATUS_DOT: Record<MusicConnectionStatus, string> = {
  connected: "bg-accent",
  disconnected: "bg-ink-subtle",
  error: "bg-danger",
  unavailable: "border border-edge",
};

const STATUS_LABEL: Record<MusicConnectionStatus, string> = {
  connected: "music.connections.statusConnected",
  disconnected: "music.connections.statusDisconnected",
  error: "music.connections.statusError",
  unavailable: "music.connections.statusUnavailable",
};

type Busy = "connect" | "disconnect" | "scan" | null;

export function MusicConnectionRow({
  connection,
  defaultOpen = false,
  onChange,
  onRefresh,
}: {
  connection: MusicConnection;
  defaultOpen?: boolean;
  onChange: (next: MusicConnection) => void;
  onRefresh: () => void;
}) {
  const t = useT();
  const rowRef = useRef<HTMLLIElement>(null);
  useMusicSourceConsent();
  const [open, setOpen] = useState(defaultOpen && connection.needs.length > 0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [scanned, setScanned] = useState<number | null>(null);
  const spotifySetup = connection.id === "spotify";
  // The connector never implements connect or disconnect, so the generic buttons only ever raise
  // "does not support sign in". The panel below owns the real Last.fm handshake.
  const lastFm = connection.id === "lastfm";
  const displayError = (message: string) => {
    const key = spotifySetup ? spotifySetupErrorKey(message) : null;
    return key ? t(key) : message;
  };

  const Icon = KIND_ICON[connection.kind];
  const folderKey = useMemo(
    () => connection.needs.find((field) => field.kind === "folder")?.key,
    [connection.needs],
  );
  const incomplete =
    (spotifySetup && !(values.clientId ?? "").trim()) ||
    connection.needs.some((field) => field.required && !(values[field.key] ?? "").trim());
  // Optional fields can reuse saved configuration, but must remain reachable on a fresh install.
  // Once submitted, these connections hand authorization off to the browser.
  const handoff = connection.needs.every((field) => !field.required);

  const connect = (payload: Record<string, string>) => {
    // These are third party services; their terms are accepted before the first connect.
    if (isGatedMusicSource(connection.id) && !musicSourceAllowed(connection.id)) {
      requestMusicSourceConsent(() => connect(payload), connection.id);
      return;
    }
    setBusy("connect");
    setFailure(null);
    setScanned(null);
    void connectSource(connection.id, payload)
      .then(async (next) => {
        onChange(next);
        setOpen(false);
        const folder = folderKey ? payload[folderKey] : undefined;
        if (next.status !== "connected") return;
        if (!folder) {
          window.dispatchEvent(new Event("harbor:music-library-changed"));
          return;
        }
        setBusy("scan");
        setScanned(await scanLocalFolder(folder));
        onRefresh();
        window.dispatchEvent(new Event("harbor:music-library-changed"));
      })
      .catch((reason) => setFailure(errorText(reason)))
      .finally(() => setBusy(null));
  };

  const disconnect = () => {
    setBusy("disconnect");
    setFailure(null);
    void disconnectSource(connection.id)
      .then(() => {
        if (isGatedMusicSource(connection.id)) setMusicSourceEnabled(connection.id, false);
        setScanned(null);
        setValues({});
        onRefresh();
        window.dispatchEvent(new Event("harbor:music-library-changed"));
      })
      .catch((reason) => setFailure(errorText(reason)))
      .finally(() => setBusy(null));
  };

  const pickFolder = (key: string) => {
    setFailure(null);
    void (async () => {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") setValues((current) => ({ ...current, [key]: picked }));
    })().catch((reason) => setFailure(errorText(reason)));
  };

  const account =
    connection.status === "connected" && connection.account
      ? t("music.connect.connected", { account: connection.account })
      : null;

  return (
    <li ref={rowRef} className="border-b border-edge-soft last:border-b-0">
      <div className="grid min-h-24 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
        <span className="grid size-10 place-items-center text-ink-muted">
          <MusicServiceLogo
            source={connection.id}
            size={32}
            fallback={<Icon size={28} aria-hidden="true" />}
          />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${STATUS_DOT[connection.status]}`}
              aria-hidden="true"
            />
            <strong className="truncate text-[14px] font-semibold text-ink" title={connection.name}>
              {connection.name}
            </strong>
            <span className="text-[11px] text-ink-muted">
              {t(
                isGatedMusicSource(connection.id) && !musicSourceAllowed(connection.id)
                  ? "music.consent.needed"
                  : connection.anonymous && connection.status === "connected"
                    ? "music.connections.statusAvailable"
                    : STATUS_LABEL[connection.status],
              )}
            </span>
          </span>
          {(account ?? connection.detail) && (
            <span className="mt-1 block break-words text-[13px] leading-5 text-ink-muted">
              {account ?? connection.detail}
            </span>
          )}
          {connection.error && (
            <span className="mt-1 block text-[13px] leading-5 text-danger">
              {displayError(connection.error)}
            </span>
          )}
          {failure && (
            <span role="alert" className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-5 text-danger">
              <span className="min-w-0">{displayError(failure)}</span>
              <button
                type="button"
                className="inline-flex h-7 shrink-0 items-center rounded-full border border-danger/40 px-3 text-[12px] font-medium text-danger transition-colors duration-200 ease-out hover:bg-danger/10"
                onClick={() => connect(connection.needs.length > 0 ? values : {})}
              >
                {t("common.retry")}
              </button>
              <button
                type="button"
                className="inline-flex h-7 shrink-0 items-center rounded-full px-2 text-[12px] font-medium text-ink-subtle transition-colors duration-200 ease-out hover:text-ink"
                aria-label={t("common.close")}
                onClick={() => setFailure(null)}
              >
                {t("common.close")}
              </button>
            </span>
          )}
          {busy === "connect" && handoff && (
            <span className="mt-1 block text-[13px] leading-5 text-ink-subtle">
              {t("music.connect.browserHandoff")}
            </span>
          )}
          {busy === "scan" && (
            <span className="mt-1 block text-[13px] leading-5 text-ink-subtle">
              {t("music.connect.scanningFolder")}
            </span>
          )}
          {busy !== "scan" && scanned !== null && (
            <span className="mt-1 block text-[13px] leading-5 text-ink-subtle">
              {t("music.connect.scanned", { count: scanned })}
            </span>
          )}
          {connection.capabilities.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {connection.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="text-[11px] text-ink-muted after:ms-1.5 after:content-['/'] last:after:content-none"
                >
                  {t(`music.connections.capability.${capability}`)}
                </span>
              ))}
            </span>
          )}
        </span>
        {lastFm || (open && connection.needs.length > 0) ? (
          <span />
        ) : (
          <RowAction
            connection={connection}
            busy={busy}
            open={open}
            onConnect={() => (connection.needs.length > 0 ? setOpen(true) : connect({}))}
            onDisconnect={disconnect}
          />
        )}
      </div>

      {lastFm && (
        <div className="border-t border-edge-soft px-4 py-4">
          <MusicLastFm embedded />
        </div>
      )}

      {connection.id === "spotify" && connection.status === "connected" && (
        <SpotifyPlaybackTarget />
      )}

      {open && connection.needs.length > 0 && (
        <form
          className="border-t border-edge-soft bg-elevated/25 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!incomplete && busy === null)
              connect(spotifySetup ? { clientId: values.clientId.trim() } : values);
          }}
        >
          {spotifySetup ? (
            <SpotifySetupFields
              clientId={values.clientId ?? ""}
              onChange={(clientId) => setValues({ clientId })}
              disabled={busy !== null}
            />
          ) : (
            <div className="grid gap-3">
              {connection.needs.map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ""}
                  onChange={(next) => setValues((current) => ({ ...current, [field.key]: next }))}
                  onPick={() => pickFolder(field.key)}
                  disabled={busy !== null}
                />
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={incomplete || busy !== null} className={PRIMARY_BUTTON}>
              {busy !== null && <LoaderCircle size={20} className="animate-spin" />}
              {busy === null
                ? t(spotifySetup ? "music.spotifySetup.authorize" : "music.connect.action")
                : t("music.connect.connecting")}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => {
              setOpen(false);
              requestAnimationFrame(() => rowRef.current?.querySelector<HTMLButtonElement>(":scope > div:first-child > button")?.focus());
            }} className={SECONDARY_BUTTON}>
              {t("common.cancel")}
            </button>
          </div>
          {spotifySetup && (
            <div className="mt-4 border-t border-edge-soft pt-3">
              <p className="text-[12px] leading-5 text-ink-muted">
                {t("music.spotifySetup.savedHint")}
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => connect({})}
                className="inline-flex min-h-11 items-center text-[12px] font-medium text-ink hover:underline disabled:opacity-40"
              >
                {t("music.spotifySetup.saved")}
              </button>
            </div>
          )}
        </form>
      )}
    </li>
  );
}

function RowAction({
  connection,
  busy,
  open,
  onConnect,
  onDisconnect,
}: {
  connection: MusicConnection;
  busy: Busy;
  open: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  useMusicSourceConsent();
  if (connection.status === "unavailable") return <span />;
  if (isGatedMusicSource(connection.id)) {
    const allowed = musicSourceAllowed(connection.id);
    return (
      <button
        type="button"
        onClick={() =>
          allowed
            ? setMusicSourceEnabled(connection.id as GatedMusicSource, false)
            : requestMusicSourceConsent(undefined, connection.id as GatedMusicSource)
        }
        className={allowed ? SECONDARY_BUTTON : PRIMARY_BUTTON}
      >
        {t(allowed ? "music.consent.turnOff" : "music.consent.review")}
      </button>
    );
  }
  if (connection.anonymous) return <span />;
  if (connection.status === "connected") {
    return (
      <button
        type="button"
        onClick={onDisconnect}
        disabled={busy !== null}
        className={SECONDARY_BUTTON}
      >
        {busy === "disconnect" && <LoaderCircle size={20} className="animate-spin" />}
        {t("music.connect.disconnect")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={busy !== null || open}
      className={PRIMARY_BUTTON}
    >
      {busy === "connect" && <LoaderCircle size={20} className="animate-spin" />}
      {busy === "connect" ? t("music.connect.connecting") : t("music.connect.action")}
    </button>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  onPick,
  disabled,
}: {
  field: MusicConnectionField;
  value: string;
  onChange: (next: string) => void;
  onPick: () => void;
  disabled: boolean;
}) {
  const t = useT();
  const id = useId();
  const label = (
    <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-subtle">
      {field.label}
    </span>
  );

  if (field.kind === "folder") {
    return (
      <div className="music-connect-folder">
        <label htmlFor={id}>{field.label}</label>
        <div className="music-connect-folder-control">
          <input id={id} readOnly value={value} placeholder={field.placeholder || t("music.connect.chooseFolder")}
            disabled={disabled} title={value || undefined} dir="auto" />
          <button type="button" onClick={onPick} disabled={disabled} className={SECONDARY_BUTTON}>
            <FolderOpen size={20} aria-hidden="true" />
            {t("music.connect.chooseFolder")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="music-connect-field block">
      {label}
      <input
        type={field.kind === "password" ? "password" : field.kind === "url" ? "url" : "text"}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={field.placeholder}
        required={field.required}
        disabled={disabled}
        autoComplete="off"
        aria-label={field.label}
        className="mt-1.5 h-11 w-full rounded-md border border-edge bg-canvas px-3 text-[14px] text-ink"
      />
    </label>
  );
}
