import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, X } from "lucide-react";
import stremioWordmark from "@/assets/stremio-wordmark.png";
import { AuthModal } from "@/components/auth-modal";
import { useT } from "@/lib/i18n";

const DISMISS_KEY = "harbor.addons.sync-nudge.dismissed.v1";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function SyncNudge({ authKey }: { authKey: string | null }) {
  const t = useT();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [showAuth, setShowAuth] = useState(false);
  const [entered, setEntered] = useState(false);

  const hidden = !!authKey || dismissed;

  useEffect(() => {
    if (hidden) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [hidden]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setEntered(false);
    setTimeout(() => setDismissed(true), 220);
  };

  return createPortal(
    <>
      <div
        className={`fixed bottom-6 end-6 z-[120] w-[min(92vw,358px)] transition-all duration-300 ease-out ${
          entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
        role="complementary"
        aria-label={t("Sync across your devices")}
      >
        <div className="relative rounded-2xl border border-edge-soft bg-elevated/95 p-5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <img
              src={stremioWordmark}
              alt="Stremio"
              draggable={false}
              className="mt-0.5 h-[18px] w-auto select-none grayscale invert"
            />
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("Dismiss")}
              className="-me-2 -mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>

          <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight text-ink">
            {t("Sync across your devices")}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            {t(
              "Anything you install here saves to your Stremio account, so your addons are ready when you open Stremio on your phone.",
            )}
          </p>

          <div className="mt-4 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAuth(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <LogIn size={14} strokeWidth={2.3} />
              {t("Sign in")}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Not now")}
            </button>
          </div>
        </div>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>,
    document.body,
  );
}
