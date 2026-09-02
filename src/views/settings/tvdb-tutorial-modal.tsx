import { Check, ExternalLink, X } from "lucide-react";
import { useModalExit } from "@/components/modal-shell";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import tvdb1 from "@/assets/tvdb-guide/tvdb1.png";
import tvdb2 from "@/assets/tvdb-guide/tvdb2.png";
import tvdb3 from "@/assets/tvdb-guide/tvdb3.png";
import tvdb4 from "@/assets/tvdb-guide/tvdb4.png";

const STEPS: { title: string; body: string; img: string; callout?: boolean }[] = [
  {
    title: "Open TheTVDB API page",
    body: "Go to thetvdb.com/api-information and scroll to the bottom, past the pricing table. Press the green Get Started button.",
    img: tvdb1,
  },
  {
    title: "Fill the form on the free tier",
    body: "For Company / Project Revenue pick 'Less than $50k per year' (Free). Company or Project Name can be anything, like Harbor, and 'This is an application that is open sourced!' works for the description.",
    img: tvdb2,
    callout: true,
  },
  {
    title: "Press Submit",
    body: "Hit the green Submit button at the bottom of the form.",
    img: tvdb3,
  },
  {
    title: "Copy your key",
    body: "The success page shows your secret API key in a box. Copy it (it is also saved in your TheTVDB dashboard), then paste it into the TVDB field in Harbor.",
    img: tvdb4,
  },
];

function linkify(text: string) {
  return text.split(/(\bhttps?:\/\/\S+|\bthetvdb\.com\/\S+)/g).map((part, i) => {
    if (!/^(https?:\/\/|thetvdb\.com\/)/.test(part)) return <span key={i}>{part}</span>;
    const trail = part.match(/[.,;:)]+$/)?.[0] ?? "";
    const url = trail ? part.slice(0, part.length - trail.length) : part;
    const href = url.startsWith("http") ? url : `https://${url}`;
    return (
      <span key={i}>
        <button
          type="button"
          onClick={() => openUrl(href)}
          className="font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
        >
          {url}
        </button>
        {trail}
      </span>
    );
  });
}

export function TvdbGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { closing, close } = useModalExit(onClose, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  if (!open) return null;
  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[250] flex items-center justify-center p-6`}
      onClick={close}
    >
      <div
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface harbor-float`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              TheTVDB
            </span>
            <h2 className="text-[17px] font-semibold text-ink">{t("Get your free TheTVDB key")}</h2>
            <p className="text-[12.5px] text-ink-subtle">
              {t("About a minute. Free for personal use.")}
            </p>
          </div>
          <button
            onClick={close}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[12.5px] font-semibold text-ink-muted">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[13.5px] font-semibold text-ink">{t(step.title)}</span>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  {linkify(t(step.body))}
                </p>
                {step.callout && (
                  <div className="mt-1 flex items-start gap-2 rounded-md bg-canvas px-3.5 py-3">
                    <Check size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-accent" />
                    <p className="text-[12.5px] leading-relaxed text-ink">
                      {t(
                        "Ignore the paid tiers. Personal use is free, you are not a company. Just pick the first option and keep going.",
                      )}
                    </p>
                  </div>
                )}
                <div className="mt-2 overflow-hidden rounded-lg bg-canvas ring-1 ring-inset ring-edge-soft">
                  <img
                    src={step.img}
                    alt=""
                    loading="lazy"
                    className="block max-h-[240px] w-full object-contain"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-5">
          <button
            onClick={close}
            className="h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Close")}
          </button>
          <button
            onClick={() => openUrl("https://thetvdb.com/api-information")}
            className="flex h-9 items-center gap-2 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("Open TheTVDB")}
            <ExternalLink size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
