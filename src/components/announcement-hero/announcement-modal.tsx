import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Announcement } from "@/lib/announcements";
import { useT } from "@/lib/i18n";

const CLOSE_MS = 200;

export function AnnouncementModal({
  announcement,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) {
  const t = useT();
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-canvas/70 p-6 backdrop-blur-sm"
      style={{
        animation: closing
          ? `ann-scrim-out ${CLOSE_MS}ms ease forwards`
          : "ann-scrim-in 220ms ease both",
      }}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: closing
            ? `ann-dialog-out ${CLOSE_MS}ms cubic-bezier(0.4,0,1,1) forwards`
            : "ann-dialog-in 340ms cubic-bezier(0.32,0.72,0.24,1) both",
        }}
        className="relative w-full max-w-[560px] overflow-hidden rounded-xl border border-edge bg-elevated shadow-[0_40px_120px_-24px_rgba(0,0,0,0.85)]"
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label={t("Close")}
          className="absolute end-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-canvas/50 text-ink-muted transition-colors hover:bg-canvas/80 hover:text-ink"
        >
          <X size={16} />
        </button>
        <div className="px-8 pt-8 pb-7">
          {announcement.label && (
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              {announcement.label}
            </span>
          )}
          {announcement.logo ? (
            <img
              src={announcement.logo}
              alt={announcement.title}
              className="mt-3 max-h-[88px] w-auto max-w-[300px] object-contain object-left rtl:object-right"
            />
          ) : (
            <h2 className="mt-2 font-display text-[30px] font-medium leading-tight tracking-tight text-ink">
              {announcement.title}
            </h2>
          )}
          {announcement.intro && (
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-muted">{announcement.intro}</p>
          )}
          {announcement.body && announcement.body.length > 0 && (
            <div className="mt-5 flex max-h-[46vh] flex-col gap-5 overflow-y-auto pr-1">
              {announcement.body.map((section, i) => (
                <div key={i} className="flex flex-col gap-2">
                  {section.heading && (
                    <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                      {section.heading}
                    </h3>
                  )}
                  <ul className="flex flex-col gap-2">
                    {section.items.map((item, j) => (
                      <li key={j} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                        <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes ann-scrim-in { from { opacity: 0 } to { opacity: 1 } }
      @keyframes ann-scrim-out { from { opacity: 1 } to { opacity: 0 } }
      @keyframes ann-dialog-in { from { opacity: 0; transform: scale(0.96) translateY(8px) } to { opacity: 1; transform: none } }
      @keyframes ann-dialog-out { from { opacity: 1; transform: none } to { opacity: 0; transform: scale(0.985) translateY(2px) } }`}</style>
    </div>,
    document.body,
  );
}
