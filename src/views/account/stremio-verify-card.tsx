import { type ReactNode, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import stremioLogo from "@/assets/stremio.png";
import { verifyWithCurrentStremio, verifyWithStremioBrowser } from "@/lib/account/stremio-link";
import { accountErrorMessage } from "@/lib/account/error-messages";
import { useAuth } from "@/lib/auth";
import { canStremioWebAuth } from "@/lib/stremio-auth";
import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";

type Busy = "current" | "browser" | null;

export function StremioVerifyCard({ author }: { author: Author }) {
  const t = useT();
  const { authKey, user } = useAuth();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  if (author.verified) {
    return (
      <div className="flex items-center gap-3">
        <img src={stremioLogo} alt="Stremio" className="h-6 w-6 shrink-0" draggable={false} />
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-ink">{t("Ownership verified")}</span>
          <span className="text-[12px] text-ink-subtle">{t("Linked to a real Stremio account.")}</span>
        </div>
        <span className="ms-auto flex h-6 items-center gap-1 rounded-full bg-accent-soft/50 px-2.5 text-[11px] font-semibold text-accent">
          <Check size={12} strokeWidth={3} /> {t("Verified")}
        </span>
      </div>
    );
  }

  const hasSession = !!authKey;
  const canBrowser = canStremioWebAuth();
  const email = user?.email || "";

  const run = async (mode: "current" | "browser") => {
    if (busy) return;
    setBusy(mode);
    setError(null);
    try {
      if (mode === "current" && authKey) await verifyWithCurrentStremio(authKey);
      else await verifyWithStremioBrowser();
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src={stremioLogo} alt="Stremio" className="h-6 w-6 shrink-0" draggable={false} />
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-ink">{t("Verify ownership")}</span>
          <span className="truncate text-[12px] text-ink-subtle">
            {hasSession
              ? email
                ? t("Confirm you own this Stremio account ({email}).", { email })
                : t("Confirm you own your Stremio account.")
              : t("Prove you own a real Stremio account.")}
          </span>
        </div>
      </div>

      {hasSession ? (
        <PrimaryButton busy={busy === "current"} onClick={() => run("current")} disabled={!!busy}>
          <img src={stremioLogo} alt="" className="h-4 w-4" draggable={false} />
          {busy === "current" ? t("Verifying...") : t("Verify ownership")}
        </PrimaryButton>
      ) : canBrowser ? (
        <PrimaryButton busy={busy === "browser"} onClick={() => run("browser")} disabled={!!busy}>
          {busy === "browser" ? t("Continue in your browser...") : t("Verify with Stremio")}
          {busy !== "browser" && <ExternalLink size={14} />}
        </PrimaryButton>
      ) : (
        <p className="rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-3 text-[12px] text-ink-subtle">
          {t("Open Harbor on desktop to verify ownership in your browser.")}
        </p>
      )}

      {hasSession && canBrowser && (
        <button
          type="button"
          onClick={() => run("browser")}
          disabled={!!busy}
          className="self-start text-[12px] font-medium text-ink-subtle transition-colors duration-150 hover:text-ink disabled:opacity-50"
        >
          {t("Use a different Stremio account")}
        </button>
      )}

      {!hasSession && canBrowser && (
        <p className="text-[11px] leading-snug text-ink-subtle">
          {t("Opens Stremio in your browser. Works with email, Facebook, and Apple. Harbor never sees your password.")}
        </p>
      )}

      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}

function PrimaryButton({
  children,
  busy,
  onClick,
  disabled,
}: {
  children: ReactNode;
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13.5px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
