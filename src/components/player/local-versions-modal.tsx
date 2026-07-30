import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { HardDrive, Play, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LocalVersionBadges } from "@/components/local-version-badges";
import {
  closeLocalVersions,
  getLocalVersions,
  subscribeLocalVersions,
  type LocalVersionsPayload,
} from "@/lib/player/local-versions-modal";

export function LocalVersionsModal() {
  const state = useSyncExternalStore(subscribeLocalVersions, getLocalVersions);
  if (!state.open || !state.payload) return null;
  return <VersionsModal payload={state.payload} />;
}

function VersionsModal({ payload }: { payload: LocalVersionsPayload }) {
  const t = useT();
  const { entries } = payload;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLocalVersions();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const play = (entry: LocalVersionsPayload["entries"][number]) => {
    const fn = payload.onPlayLocal;
    closeLocalVersions();
    fn(entry);
  };

  return createPortal(
    <div
      data-tv-focus-scope
      className="animate-fade-in fixed inset-0 z-[210] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLocalVersions();
      }}
    >
      <div className="animate-modal-in flex max-h-[86vh] w-[min(94vw,620px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3 border-b border-edge-soft px-5 pb-3.5 pt-4">
          {payload.poster && (
            <img
              src={payload.poster}
              alt=""
              className="h-11 w-8 shrink-0 rounded-md object-cover ring-1 ring-edge-soft"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <h2
              className="truncate font-display text-[18px] font-medium text-ink"
              title={payload.title}
            >
              {payload.title}
            </h2>
            <span className="text-[12px] text-ink-subtle">
              {t("{n} versions on your disk", { n: entries.length })}
            </span>
          </div>
          <button
            type="button"
            data-tv-modal-close
            onClick={() => closeLocalVersions()}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto p-4">
          {entries.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => play(entry)}
              autoFocus={i === 0}
              data-tv-initial-focus={i === 0 || undefined}
              className="group/v flex items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-raised"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <HardDrive size={16} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[13.5px] text-ink" title={entry.path}>
                  {entry.filename}
                </span>
                <LocalVersionBadges entry={entry} />
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors group-hover/v:bg-ink group-hover/v:text-canvas">
                <Play size={13} strokeWidth={2.4} fill="currentColor" className="ml-0.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
