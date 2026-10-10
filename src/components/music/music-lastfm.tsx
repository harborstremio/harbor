import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, LoaderCircle, Radio, Unplug } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import {
  completeLastFmAuth,
  getLastFmStatus,
  LASTFM_API_KEY,
  LASTFM_API_SECRET,
  LASTFM_SESSION_KEY,
  LASTFM_USERNAME,
  startLastFmAuth,
} from "@/lib/music/lastfm";
import { useMusicPlayer } from "@/lib/music/player";
import { flushSecrets, getSecret, setSecret } from "@/lib/secret-store";
import { openUrl } from "@/lib/window";
import "./music-connect-field.css";

export function MusicLastFm({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useT();
  const [apiKey, setApiKey] = useState(() => getSecret(LASTFM_API_KEY) ?? "");
  const [apiSecret, setApiSecret] = useState(() => getSecret(LASTFM_API_SECRET) ?? "");
  const [connected, setConnected] = useState(() => Boolean(getSecret(LASTFM_SESSION_KEY)));
  const [username, setUsername] = useState(() => getSecret(LASTFM_USERNAME) ?? "");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrobbleError = useMusicPlayer().scrobbleError;

  useEffect(() => {
    let cancelled = false;
    void getLastFmStatus()
      .then((status) => {
        if (cancelled) return;
        setConnected(status.connected);
        if (status.username) setUsername(status.username);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDraft = () => {
    setSecret(LASTFM_API_KEY, apiKey.trim() || null);
    setSecret(LASTFM_API_SECRET, apiSecret.trim() || null);
    void flushSecrets();
  };

  const begin = () => {
    if (!apiKey.trim() || !apiSecret.trim() || working) return;
    setWorking(true);
    setError(null);
    void (async () => {
      setSecret(LASTFM_API_KEY, apiKey.trim());
      setSecret(LASTFM_API_SECRET, apiSecret.trim());
      await flushSecrets();
      const auth = await startLastFmAuth(apiKey.trim(), apiSecret.trim());
      setPendingToken(auth.token);
      openUrl(auth.authUrl);
    })()
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setWorking(false));
  };

  const finish = () => {
    if (!pendingToken || working) return;
    setWorking(true);
    setError(null);
    void completeLastFmAuth(apiKey.trim(), apiSecret.trim(), pendingToken)
      .then(async (session) => {
        setSecret(LASTFM_SESSION_KEY, session.sessionKey);
        setSecret(LASTFM_USERNAME, session.username);
        await flushSecrets();
        setUsername(session.username);
        setConnected(true);
        setPendingToken(null);
        setExpanded(false);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setWorking(false));
  };

  const disconnect = () => {
    setSecret(LASTFM_API_KEY, null);
    setSecret(LASTFM_API_SECRET, null);
    setSecret(LASTFM_SESSION_KEY, null);
    setSecret(LASTFM_USERNAME, null);
    void flushSecrets();
    setApiKey("");
    setApiSecret("");
    setPendingToken(null);
    setUsername("");
    setConnected(false);
    setExpanded(false);
    setError(null);
  };

  const open = embedded || expanded;
  return (
    <section className={embedded ? "" : "rounded-xl border border-edge-soft bg-surface"}>
      {!embedded && (
        <button
          type="button"
          className="grid min-h-14 w-full grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 text-start"
          onClick={() => !connected && setExpanded((value) => !value)}
          aria-expanded={connected ? undefined : expanded}
        >
          <span className="grid size-8 place-items-center rounded-full bg-elevated text-ink-muted">
            <Radio size={14} />
          </span>
          <span className="min-w-0">
            <strong className="block text-[13px] font-semibold text-ink">Last.fm</strong>
            <small className="mt-0.5 block truncate text-[11px] text-ink-subtle">
              {connected
                ? username || t("music.lastfm.connected")
                : apiKey
                  ? t("music.lastfm.saved")
                  : t("music.lastfm.history")}
            </small>
          </span>
          <i
            className={`font-mono text-[10px] not-italic uppercase tracking-[0.12em] ${connected ? "text-success" : "text-ink-subtle"}`}
          >
            {connected ? t("music.lastfm.live") : t("music.lastfm.connect")}
          </i>
          {!connected && (
            <ChevronDown
              size={14}
              className={`text-ink-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          )}
        </button>
      )}

      {connected ? (
        <div className={embedded ? "flex flex-wrap items-center gap-2" : "space-y-2 border-t border-edge-soft p-3"}>
          {username && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-edge px-4 text-[12px] text-ink-muted transition-colors duration-200 ease-out hover:border-edge-soft hover:text-ink"
              onClick={() => openUrl(`https://www.last.fm/user/${encodeURIComponent(username)}`)}
            >
              {t("music.lastfm.viewProfile")} <ArrowUpRight size={13} />
            </button>
          )}

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12px] text-ink-subtle transition-colors duration-200 ease-out hover:bg-elevated hover:text-ink"
            onClick={disconnect}
          >
            <Unplug size={13} /> {t("music.lastfm.disconnect")}
          </button>

          {scrobbleError && (
            <p role="alert" className="w-full text-[12px] leading-relaxed text-danger">
              {scrobbleError}
            </p>
          )}
        </div>
      ) : (
        open && (
          <div className={embedded ? "space-y-4" : "space-y-4 border-t border-edge-soft p-3"}>
            <p className="text-[13px] leading-relaxed text-ink-muted">{t("music.lastfm.keyHelp")}</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openUrl("https://www.last.fm/api/account/create")}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-edge px-4 text-[12px] text-ink-muted transition-colors duration-200 ease-out hover:border-edge-soft hover:text-ink"
              >
                {t("music.lastfm.getKey")} <ArrowUpRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => openUrl("https://www.last.fm/join")}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-edge px-4 text-[12px] text-ink-muted transition-colors duration-200 ease-out hover:border-edge-soft hover:text-ink"
              >
                {t("music.lastfm.createAccount")} <ArrowUpRight size={13} />
              </button>
            </div>

            <label className="music-connect-field block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              {t("music.lastfm.apiKey")}
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
                onBlur={persistDraft}
                autoComplete="off"
                aria-label={t("music.lastfm.apiKey")}
                className="mt-1.5 h-11 w-full rounded-md border border-edge bg-canvas px-3 font-sans text-[14px] normal-case tracking-normal text-ink"
              />
            </label>
            <label className="music-connect-field block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              {t("music.lastfm.secret")}
              <input
                type="password"
                value={apiSecret}
                onChange={(event) => setApiSecret(event.currentTarget.value)}
                onBlur={persistDraft}
                autoComplete="off"
                aria-label={t("music.lastfm.secret")}
                className="mt-1.5 h-11 w-full rounded-md border border-edge bg-canvas px-3 font-sans text-[14px] normal-case tracking-normal text-ink"
              />
            </label>
            <button
              type="button"
              onClick={pendingToken ? finish : begin}
              disabled={working || (!pendingToken && (!apiKey.trim() || !apiSecret.trim()))}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas transition-opacity duration-200 ease-out disabled:opacity-40"
            >
              {working ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : pendingToken ? (
                <Check size={14} />
              ) : (
                <ArrowUpRight size={14} />
              )}
              {pendingToken ? t("music.lastfm.finish") : t("music.lastfm.authorize")}
            </button>
            {pendingToken && (
              <p className="text-[12px] leading-relaxed text-ink-subtle">{t("music.lastfm.browserPrompt")}</p>
            )}
          </div>
        )
      )}
      {error && (
        <p className={embedded ? "pt-3 text-[12px] text-danger" : "border-t border-danger/25 px-3 py-2 text-[12px] text-danger"}>{error}</p>
      )}
    </section>
  );
}
