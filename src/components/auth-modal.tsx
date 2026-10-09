import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { JlAccountForm } from "./jl-account-form";
import { useJlSession } from "@/lib/jl/account/client";
import { useT } from "@/lib/i18n";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const session = useJlSession();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => { if (session) onClose(); }, [session, onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLElement>("input, button")?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const targets = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]") ?? [])];
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="animate-scrim-in fixed inset-0 z-[240] flex items-center justify-center p-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-label={t("JL Media Vision account")}
        className="animate-dialog-in flex max-h-[90vh] w-[min(92vw,440px)] flex-col gap-5 overflow-y-auto rounded-md bg-surface p-7 shadow-xl">
        <h2 className="font-display text-[22px] font-medium text-ink">{t("JL Media Vision account")}</h2>
        <JlAccountForm intro={t("Your library and addons work locally. Sign in to use JL account features.")} />
        <button type="button" onClick={onClose} className="h-11 text-ink-subtle">{t("Continue locally")}</button>
      </section>
    </div>, document.body,
  );
}
