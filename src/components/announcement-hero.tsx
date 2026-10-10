import { useState } from "react";
import type { Announcement } from "@/lib/announcements";
import { useT } from "@/lib/i18n";
import { AnnouncementModal } from "./announcement-hero/announcement-modal";

const EXIT_MS = 380;

export function AnnouncementHero({
  announcement,
  onSeen,
  onDismiss,
}: {
  announcement: Announcement;
  onSeen: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const startLeaving = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDismiss, EXIT_MS);
  };
  const openModal = () => {
    onSeen();
    setOpen(true);
  };

  return (
    <section
      className="group relative -mx-12 -mt-28"
      style={{
        animation: leaving
          ? `announce-exit ${EXIT_MS}ms cubic-bezier(0.4,0,0.2,1) forwards`
          : "announce-enter 560ms cubic-bezier(0.32,0.72,0.24,1) both",
      }}
    >
      <div className="absolute inset-0 z-0 overflow-hidden">
        {announcement.hero && (
          <img
            src={announcement.hero}
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "72% center" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[var(--color-canvas)] from-0% via-[color-mix(in_oklch,var(--color-canvas),transparent_50%)] via-55% to-[color-mix(in_oklch,var(--color-canvas),transparent_92%)] to-100%" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            background:
              "linear-gradient(to top, var(--color-canvas), color-mix(in oklch, var(--color-canvas), transparent 62%) 50%, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-[560px] items-end px-20 pt-24 pb-12">
        <div className="flex max-w-[560px] flex-col gap-6">
          {announcement.logo ? (
            <img
              src={announcement.logo}
              alt={announcement.title}
              decoding="async"
              className="max-h-[212px] w-auto max-w-[520px] object-contain object-left rtl:object-right drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <h1 className="font-display text-[56px] font-medium leading-[0.98] tracking-tight text-ink drop-shadow-[0_2px_22px_rgba(0,0,0,0.6)]">
              {announcement.title}
            </h1>
          )}
          {announcement.intro && (
            <p className="max-w-[440px] text-[14.5px] leading-relaxed text-ink-muted">
              {announcement.intro}
            </p>
          )}
          <div className="mt-1 flex items-center gap-4">
            <button
              type="button"
              onClick={openModal}
              style={{ animation: "announce-pulse 2.6s cubic-bezier(0.32,0.72,0.24,1) infinite" }}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-canvas transition-colors duration-150 hover:bg-accent/90"
            >
              {announcement.cta ?? t("Know More")}
            </button>
            <button
              type="button"
              onClick={startLeaving}
              className="text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              {t("Maybe later")}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes announce-pulse {
        0% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-accent), transparent 42%); }
        70% { box-shadow: 0 0 0 13px transparent; }
        100% { box-shadow: 0 0 0 0 transparent; }
      }
      @keyframes announce-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes announce-exit { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-16px) scale(0.992); } }`}</style>

      {open && (
        <AnnouncementModal
          announcement={announcement}
          onClose={() => {
            setOpen(false);
            startLeaving();
          }}
        />
      )}
    </section>
  );
}
