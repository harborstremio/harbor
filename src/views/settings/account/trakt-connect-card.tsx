import traktLogo from "@/assets/trakt.png";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { fetchTraktUser, pollDeviceToken, requestDeviceCode, type DeviceCode } from "@/lib/trakt";
import { setSession } from "@/lib/trakt/session";
import { openUrl } from "@/lib/window";
import { ArrowRight, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { DocsCode } from "../relay-docs";
import { ExtLink } from "../shared";

function TraktBadge() {
  return (
    <span className="flex h-10 w-[64px] shrink-0 items-center justify-center rounded-md bg-white px-2 ring-1 ring-edge-soft">
      <img src={traktLogo} alt="Trakt" draggable={false} className="h-3.5 w-auto object-contain" />
    </span>
  );
}

export function TraktConnectCard() {
  const t = useT();
  const { settings, update } = useSettings();
  const connected = !!settings.traktAccessToken;
  const hasCreds = !!settings.traktClientId && !!settings.traktClientSecret;
  const [phase, setPhase] = useState<"idle" | "configuring" | "starting" | "awaiting" | "polling" | "error">("idle");
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clientIdDraft, setClientIdDraft] = useState(settings.traktClientId ?? "");
  const [clientSecretDraft, setClientSecretDraft] = useState(settings.traktClientSecret ?? "");

  const start = async () => {
    setError(null);
    setPhase("starting");
    try {
      const c = await requestDeviceCode(settings.traktClientId);
      setCode(c);
      setPhase("awaiting");
      void openUrl(c.verification_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  useEffect(() => {
    if (phase !== "polling" || !code) return;
    let cancelled = false;
    const deadline = Date.now() + code.expires_in * 1000;
    let interval = code.interval * 1000;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() > deadline) {
        setError("Code expired. Try again.");
        setPhase("error");
        return;
      }
      const r = await pollDeviceToken(settings.traktClientId, settings.traktClientSecret, code.device_code);
      if (cancelled) return;
      if (r.status === "ok") {
        const expiresAt = Date.now() + r.token.expires_in * 1000;
        const user = await fetchTraktUser(settings.traktClientId, r.token.access_token);
        update({
          traktAccessToken: r.token.access_token,
          traktRefreshToken: r.token.refresh_token,
          traktExpiresAt: expiresAt,
          traktUsername: user?.username ?? null,
        });
        setSession({
          accessToken: r.token.access_token,
          refreshToken: r.token.refresh_token,
          createdAt: r.token.created_at,
          expiresIn: r.token.expires_in,
          username: user?.username ?? null,
        });
        setPhase("idle");
        setCode(null);
        return;
      }
      if (r.status === "expired") {
        setError("Code expired. Try again.");
        setPhase("error");
        return;
      }
      if (r.status === "denied") {
        setError("Authorization denied.");
        setPhase("error");
        return;
      }
      if (r.status === "error") {
        setError(r.message);
        setPhase("error");
        return;
      }
      if (r.status === "slow_down") interval += 1000;
      window.setTimeout(tick, interval);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [phase, code, settings.traktClientId, settings.traktClientSecret, update]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const cancel = () => {
    setPhase("idle");
    setCode(null);
    setError(null);
  };

  const disconnect = () => {
    update({
      traktAccessToken: null,
      traktRefreshToken: null,
      traktExpiresAt: 0,
      traktUsername: null,
    });
    setSession(null);
  };

  if (phase === "awaiting" || phase === "polling") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
        <div className="flex items-start gap-4">
          <TraktBadge />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14.5px] font-medium text-ink">{t("Authorize Harbor on Trakt")}</span>
            <span className="text-[12.5px] leading-snug text-ink-muted">
              {t("We opened {url} in your browser. Enter the code below.", { url: code?.verification_url ?? "" })}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 rounded-xl border border-edge-soft bg-elevated/60 py-4">
          <span className="font-mono text-[28px] font-bold tracking-[0.4em] text-ink">{code?.user_code ?? ""}</span>
          <button
            onClick={copy}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t("Copied") : t("Copy")}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={cancel}
            className="flex h-10 items-center rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {t("Cancel")}
          </button>
          {phase === "awaiting" ? (
            <button
              onClick={() => setPhase("polling")}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
            >
              {t("I authorized it")}
              <ArrowRight size={13} strokeWidth={2.2} className="dir-icon" />
            </button>
          ) : (
            <span className="flex h-10 items-center gap-2 px-3 text-[12.5px] text-ink-muted">
              <Loader2 size={13} className="animate-spin" />
              {t("Waiting for Trakt…")}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
      <div className="flex items-center gap-4">
        <TraktBadge />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14.5px] font-medium text-ink">
            {connected ? t("Connected as @{user}", { user: settings.traktUsername ?? "user" }) : t("Connect Trakt")}
          </span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {connected
              ? t("Plays + ratings sync from Harbor to Trakt.tv.")
              : t("Mirror plays + ratings to Trakt.tv. Uses Trakt's device flow: enter a short code in your browser.")}
          </span>
        </div>
        {connected ? (
          <button
            onClick={disconnect}
            className="flex h-10 shrink-0 items-center rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-subtle transition-colors hover:border-danger/40 hover:text-danger"
          >
            {t("Disconnect")}
          </button>
        ) : hasCreds ? (
          <button
            onClick={start}
            disabled={phase === "starting"}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {phase === "starting" ? <Loader2 size={13} className="animate-spin" /> : null}
            {phase === "starting" ? t("Starting…") : t("Connect")}
            {phase !== "starting" && <ExternalLink size={13} strokeWidth={2.2} />}
          </button>
        ) : (
          <button
            onClick={() => setPhase(phase === "configuring" ? "idle" : "configuring")}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {phase === "configuring" ? t("Hide") : t("Set up")}
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>
      )}
      {phase === "configuring" && !connected && (
        <div className="flex flex-col gap-3 border-t border-edge-soft/60 pt-3">
          <p className="text-[12.5px] text-ink-muted">
            Register a Trakt app at{" "}
            <ExtLink href="https://trakt.tv/oauth/applications/new">trakt.tv/oauth/applications/new</ExtLink>. For the
            redirect URI use <DocsCode>urn:ietf:wg:oauth:2.0:oob</DocsCode>. Paste the credentials it gives you below.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={clientIdDraft}
              onChange={(e) => setClientIdDraft(e.target.value)}
              placeholder={t("Client ID")}
              className="h-11 rounded-xl border border-edge bg-canvas px-3.5 font-mono text-[13px] text-ink outline-none focus:border-ink"
            />
            <input
              type="password"
              value={clientSecretDraft}
              onChange={(e) => setClientSecretDraft(e.target.value)}
              placeholder={t("Client secret")}
              className="h-11 rounded-xl border border-edge bg-canvas px-3.5 font-mono text-[13px] text-ink outline-none focus:border-ink"
            />
            <button
              onClick={() => {
                update({
                  traktClientId: clientIdDraft.trim(),
                  traktClientSecret: clientSecretDraft.trim(),
                });
                setPhase("idle");
              }}
              disabled={!clientIdDraft.trim() || !clientSecretDraft.trim()}
              className="flex h-10 items-center justify-center rounded-xl bg-ink text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {t("Save credentials")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
