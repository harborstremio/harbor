import { openUrl } from "@/lib/window";
import { Check, ExternalLink, KeyRound, X } from "lucide-react";
import { useEffect } from "react";

const STEPS: { title: string; body: string; callout?: boolean }[] = [
  {
    title: "Make a free TMDB account",
    body: "Open themoviedb.org and sign up. It is completely free and takes a few seconds.",
  },
  {
    title: "Open the API settings",
    body: "Profile picture, then Settings, then API in the left sidebar. Press Create and pick Developer.",
  },
  {
    title: "Fill the form (the part everyone gets stuck on)",
    body: "It asks for an Application URL plus a few details. None of it is ever checked. Put anything in the URL field and keep going.",
    callout: true,
  },
  {
    title: "Copy your API Key (v3 auth)",
    body: "After you submit, copy the value labelled API Key (v3 auth). It is the short one, not the long Read Access Token.",
  },
  {
    title: "Paste it into Harbor",
    body: "Drop it in the TMDB field right here. Harbor saves it on its own and the whole app lights up.",
  },
];

export function TmdbGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-canvas/70 p-6 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border border-edge bg-elevated shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] animate-popover-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-edge-soft px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <KeyRound size={18} strokeWidth={2.2} />
            </span>
            <div className="flex flex-col">
              <h2 className="font-display text-[20px] font-medium tracking-tight text-ink">Get your free TMDB key</h2>
              <p className="text-[12.5px] text-ink-muted">About 30 seconds. No payment, ever.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-6">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-[13px] font-semibold text-ink">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[14.5px] font-medium text-ink">{step.title}</span>
                <p className="text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
                {step.callout && (
                  <div className="mt-1 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3">
                    <Check size={15} strokeWidth={2.6} className="mt-0.5 shrink-0 text-accent" />
                    <p className="text-[12.5px] leading-relaxed text-ink">
                      For Application URL, type any address at all, like https://harbor.app or http://localhost. TMDB
                      never visits it. The only thing you actually need is the API key.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Close
          </button>
          <button
            onClick={() => openUrl("https://www.themoviedb.org/settings/api")}
            className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Open TMDB
            <ExternalLink size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
