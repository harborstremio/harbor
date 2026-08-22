import { ArrowRight, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import cfTokenTutorial from "@/assets/cf-token-tutorial.png";
import cloudflareLogoPng from "@/assets/cloudflare.png";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { deployRelay, listAccounts, type CfAccount } from "@/lib/together/cf-deploy";
import { openUrl } from "@/lib/window";

type Phase = "intro" | "token" | "account" | "deploying" | "done" | "error";

export function TogetherDeployModal({
  onClose,
  inline = false,
}: {
  onClose: () => void;
  inline?: boolean;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const [phase, setPhase] = useState<Phase>(settings.togetherCfToken ? "deploying" : "intro");
  const [token, setToken] = useState(settings.togetherCfToken);
  const [accounts, setAccounts] = useState<CfAccount[]>([]);
  const [accountId, setAccountId] = useState(settings.togetherCfAccountId);
  const [error, setError] = useState<string | null>(null);
  const [triedAccountId, setTriedAccountId] = useState<string>("");
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "deploying") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  useEffect(() => {
    if (phase !== "deploying") return;
    let cancelled = false;
    (async () => {
      let acctId = accountId;
      try {
        if (!acctId) acctId = await pickFirstAccount();
        if (cancelled) return;
        setTriedAccountId(acctId);
        const r = await deployRelay(token, acctId);
        if (cancelled) return;
        update({
          togetherRelayUrl: r.url,
          togetherCfToken: token,
          togetherCfAccountId: r.account_id,
          togetherCfDeployed: true,
        });
        setResult({ url: r.url });
        setPhase("done");
      } catch (e) {
        if (cancelled) return;
        setTriedAccountId(acctId);
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };

    async function pickFirstAccount(): Promise<string> {
      const list = await listAccounts(token);
      if (list.length === 0) throw new Error("No Cloudflare accounts found for this token.");
      return list[0].id;
    }
  }, [phase, token, accountId, update]);

  const verifyTokenAndPickAccount = async () => {
    setError(null);
    if (!token.trim()) {
      setError(t("Paste your API token first."));
      return;
    }
    try {
      const list = await listAccounts(token.trim());
      if (list.length === 0) {
        setError(t("Token works, but no accounts came back. Check the token's permissions."));
        return;
      }
      setAccounts(list);
      setAccountId(list[0].id);
      setPhase(list.length === 1 ? "deploying" : "account");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const body = (
    <>
      {phase !== "deploying" && phase !== "done" && (
        <button
          onClick={onClose}
          className="flex h-8 w-fit items-center gap-1.5 rounded-lg px-2 -ms-2 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="dir-icon"
          >
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("Relay")}
        </button>
      )}
      <header>
        <h2 className="font-display text-[26px] font-medium leading-tight tracking-tight text-ink">
          {t("Deploy your relay")}
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          {t(
            "Spins up a tiny server on Cloudflare's free Workers tier. Stays online forever (or until you stop it). Friends connect by URL.",
          )}
        </p>
      </header>

      {phase === "intro" && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => openUrl("https://dash.cloudflare.com/profile/api-tokens")}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-medium text-canvas transition-transform hover:scale-[1.01]"
          >
            <ExternalLink size={15} strokeWidth={1.8} />
            {t("Open Cloudflare API Tokens")}
          </button>
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              <Interpolate
                text={t("Sign in, select {b1}, then select {b2} under {b3}.")}
                values={{
                  b1: <b>{t("Create Token")}</b>,
                  b2: <b>{t("Get started")}</b>,
                  b3: <b>{t("Create Custom Token")}</b>,
                }}
              />
            </Step>
            <Step n={2}>
              <Interpolate
                text={t("Under Permissions, add one permission and set it to {b1} → {b2} → {b3}.")}
                values={{
                  b1: <b>{t("Account")}</b>,
                  b2: <b>{t("Workers Scripts")}</b>,
                  b3: <b>{t("Edit")}</b>,
                }}
              />
              <img
                src={cfTokenTutorial}
                alt={t(
                  "Cloudflare token form filled with name 'Harbor Relay' and one permission row set to Account / Workers Scripts / Edit",
                )}
                className="mt-2 w-full rounded-lg border border-edge"
              />
              <span className="mt-2 block text-[12px] text-ink-subtle">
                {t("The token name can be anything. Do not add extra permissions.")}
              </span>
            </Step>
            <Step n={3}>
              <Interpolate
                text={t(
                  "Leave everything below it alone. Scroll down, click {b1}, then {b2}. Copy the long string it shows you (you only see it once) and bring it back here.",
                )}
                values={{
                  b1: <b>{t("Continue to summary")}</b>,
                  b2: <b>{t("Create Token")}</b>,
                }}
              />
            </Step>
          </ol>
          <button
            onClick={() => setPhase("token")}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-edge text-[14px] text-ink transition-colors hover:bg-elevated"
          >
            {t("I have my token")}
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {phase === "token" && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-muted">{t("API token")}</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("40-character token")}
              autoFocus
              className="h-11 rounded-xl border border-edge bg-canvas px-3.5 font-mono text-[13px] text-ink transition-colors focus:border-accent"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-danger/15 px-3 py-2 text-[13px] text-danger">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setPhase("intro")}
              className="h-11 flex-1 rounded-xl border border-edge text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("Back")}
            </button>
            <button
              onClick={verifyTokenAndPickAccount}
              disabled={!token.trim()}
              className="h-11 flex-1 rounded-xl bg-ink text-[14px] font-medium text-canvas transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              {t("Continue")}
            </button>
          </div>
        </div>
      )}

      {phase === "account" && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-muted">
            {t("Which account should the relay live in?")}
          </p>
          <div className="flex flex-col gap-1.5">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setAccountId(a.id);
                  setPhase("deploying");
                }}
                className="flex h-12 items-center justify-between rounded-xl border border-edge px-4 text-start text-[14px] text-ink transition-colors hover:bg-elevated"
              >
                <span>{a.name}</span>
                <span className="font-mono text-[11px] text-ink-subtle">{a.id.slice(0, 8)}…</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "deploying" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 size={32} strokeWidth={1.8} className="animate-spin text-accent" />
          <div className="text-center">
            <p className="text-[14px] text-ink">{t("Uploading worker, wiring durable object…")}</p>
            <p className="mt-1 text-[12px] text-ink-subtle">{t("Takes about 10 seconds.")}</p>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/30 text-accent">
              <Check size={18} strokeWidth={2.4} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-medium text-ink">{t("Relay is live")}</span>
              <span className="text-[12px] text-ink-muted">
                {t("URL is saved and ready to share.")}
              </span>
            </div>
            <img
              src={cloudflareLogoPng}
              alt="Cloudflare"
              className="h-7 w-auto shrink-0 opacity-90"
              draggable={false}
            />
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-edge bg-canvas/60 p-4">
            <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
              {t("Your relay URL")}
            </span>
            <p className="break-all font-mono text-[13px] text-ink">{result.url}</p>
            <button
              onClick={copyUrl}
              className={`group relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-lg text-[14px] font-medium transition-[background-color,color] duration-200 ${
                copied ? "bg-accent/20 text-accent" : "bg-ink text-canvas hover:opacity-90"
              }`}
            >
              <span
                key={copied ? "copied" : "idle"}
                className="flex items-center gap-2 animate-copy-swap"
              >
                {copied ? (
                  <>
                    <Check size={16} strokeWidth={2.6} className="animate-copy-check" />
                    {t("Copied. Paste it to your friend.")}
                  </>
                ) : (
                  <>
                    <Copy size={15} strokeWidth={2} />
                    {t("Copy URL")}
                  </>
                )}
              </span>
            </button>
          </div>
          <p className="text-[12px] text-ink-subtle">
            {t(
              "Send this to anyone you want to watch with. They paste it in their Settings → Harbor Relay. After that, share a 6-character room code from the people icon up top.",
            )}
          </p>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-edge text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Done")}
          </button>
        </div>
      )}

      {phase === "error" && (
        <ErrorPanel
          message={error ?? t("Something went wrong.")}
          accountId={triedAccountId}
          onClose={onClose}
          onRetry={() => setPhase("deploying")}
          onEditToken={() => setPhase("token")}
        />
      )}
    </>
  );

  if (inline) {
    return <div className="flex flex-col gap-5">{body}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-canvas/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-[560px] flex-col gap-5 overflow-y-auto rounded-2xl border border-edge bg-surface p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        {body}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-ink-muted">
        {n}
      </span>
      <div className="text-[13px] leading-snug text-ink">{children}</div>
    </li>
  );
}

function ErrorPanel({
  message,
  accountId,
  onClose,
  onRetry,
  onEditToken,
}: {
  message: string;
  accountId: string;
  onClose: () => void;
  onRetry: () => void;
  onEditToken: () => void;
}) {
  const t = useT();
  const needsSubdomain = /workers\.dev subdomain/i.test(message);
  const dashUrl = accountId
    ? `https://dash.cloudflare.com/${accountId}/workers-and-pages`
    : "https://dash.cloudflare.com/?to=/:account/workers-and-pages";

  if (needsSubdomain) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-edge bg-canvas/60 p-4">
          <span className="text-[13px] font-medium text-ink">
            {t("One last thing on Cloudflare's side")}
          </span>
          <p className="text-[13px] leading-snug text-ink-muted">
            <Interpolate
              text={t(
                "Your account hasn't picked its free {code} address yet. Cloudflare only asks the first time. Quick to set up.",
              )}
              values={{ code: <span className="font-mono text-ink">workers.dev</span> }}
            />
          </p>
        </div>
        <ol className="flex flex-col gap-2.5 text-[13px] text-ink">
          <Step n={1}>{t("Click the button below to open Cloudflare's Workers page.")}</Step>
          <Step n={2}>
            <Interpolate
              text={t(
                "Click {b1} in the top right. Pick the {b2} template (it's the default, should already be selected).",
              )}
              values={{
                b1: <b>{t("Create")}</b>,
                b2: <b>{t("Hello World")}</b>,
              }}
            />
          </Step>
          <Step n={3}>
            <Interpolate
              text={t(
                "Cloudflare asks you to pick a name (this becomes {code}). Type any name (your first name works). Then click {b1}.",
              )}
              values={{
                code: <span className="font-mono text-ink">yourname.workers.dev</span>,
                b1: <b>{t("Deploy")}</b>,
              }}
            />
          </Step>
          <Step n={4}>
            <Interpolate
              text={t(
                "Come back here and hit {b1}. The Hello World can stay where it is. It's free and harmless.",
              )}
              values={{
                b1: <b>{t("Try deploy again")}</b>,
              }}
            />
          </Step>
        </ol>
        <button
          onClick={() => openUrl(dashUrl)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-edge text-[14px] text-ink transition-colors hover:bg-elevated"
        >
          <ExternalLink size={15} strokeWidth={1.8} />
          {t("Open Cloudflare Workers")}
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-edge text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Close")}
          </button>
          <button
            onClick={onRetry}
            className="h-11 flex-1 rounded-xl bg-ink text-[14px] font-medium text-canvas transition-transform hover:scale-[1.02]"
          >
            {t("Try deploy again")}
          </button>
        </div>
      </div>
    );
  }

  const linkified = linkifyMessage(message);
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-danger/15 px-3 py-2 text-[13px] text-danger">{linkified}</p>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="h-11 flex-1 rounded-xl border border-edge text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          {t("Close")}
        </button>
        <button
          onClick={onEditToken}
          className="h-11 flex-1 rounded-xl bg-ink text-[14px] font-medium text-canvas transition-transform hover:scale-[1.02]"
        >
          {t("Try again")}
        </button>
      </div>
    </div>
  );
}

function linkifyMessage(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <button
        key={i}
        onClick={() => openUrl(part)}
        className="underline underline-offset-2 hover:text-ink"
      >
        {part}
      </button>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Interpolate({ text, values }: { text: string; values: Record<string, React.ReactNode> }) {
  const parts = text.split(/({[a-zA-Z0-9]+})/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^{([a-zA-Z0-9]+)}$/);
        if (match && values[match[1]]) {
          return <span key={i}>{values[match[1]]}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
