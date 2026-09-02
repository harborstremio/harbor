import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Globe2, HardDrive, X } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { MediaServerBrand } from "@/components/media-server-brand";
import { MediaServerVersionBadges } from "@/components/media-server-version-badges";
import { mediaServerConnections } from "@/lib/media-server/connections";
import { useMediaServerHealth } from "@/hooks/use-media-server-health";
import { useT } from "@/lib/i18n";
import { LocalVersionBadges } from "@/components/local-version-badges";
import { isBigPictureActive } from "@/lib/big-picture";
import { pushBpBack } from "@/views/big-picture/bp-back";
import { bpFocusables, currentBpFocus, setBpFocus } from "@/views/big-picture/use-bp-focus";
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
  const connections = mediaServerConnections();
  const health = useMediaServerHealth(connections);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const bigPicture = isBigPictureActive();
  const portalTarget = bigPicture
    ? (document.querySelector<HTMLElement>("[data-bp-root]") ?? document.body)
    : document.body;

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

  useEffect(() => {
    if (!bigPicture) return;
    const previous = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    const removeBack = pushBpBack(() => {
      closeLocalVersions();
      return true;
    });
    const frame = requestAnimationFrame(() => {
      const first = bpFocusables(modalRef.current).find(
        (element) => !element.hasAttribute("disabled"),
      );
      if (first) setBpFocus(first, { silent: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      removeBack();
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, [bigPicture]);

  const play = (entry: LocalVersionsPayload["entries"][number]) => {
    const fn = payload.onPlayLocal;
    closeLocalVersions();
    fn(entry);
  };

  return createPortal(
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={payload.title}
      data-bp-dialog={bigPicture || undefined}
      data-tv-focus-scope
      className={`animate-fade-in fixed inset-0 z-[210] flex items-center justify-center bg-canvas/80 backdrop-blur-sm ${bigPicture ? "px-[var(--bp-gutter)] py-[var(--bp-page-top)]" : "p-4"}`}
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
              {payload.onStream
                ? t("Choose where to watch")
                : t("{n} versions on your disk", { n: entries.length })}
            </span>
          </div>
          <button
            type="button"
            data-bp-focusable={bigPicture || undefined}
            data-tv-modal-close
            onClick={() => closeLocalVersions()}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto p-4">
          {entries.length > 0 && payload.serverCopies?.length ? (
            <p className="px-3 pt-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {t("This device")}
            </p>
          ) : null}
          {entries.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              data-bp-focusable={bigPicture || undefined}
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
          {(payload.serverCopies?.length ?? 0) > 0 && (
            <p className="px-3 pt-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {t("Home servers")}
            </p>
          )}
          {payload.serverCopies?.map((copy, index) => {
            const connectionId = copy.connectionId;
            const status = connectionId ? health[connectionId] : "inactive";
            const connection = connections.find((entry) => entry.id === connectionId);
            const unavailable = !connection || !connection.enabled || status !== "active";
            return (
              <button
                key={copy.key}
                type="button"
                data-bp-focusable={bigPicture || undefined}
                disabled={unavailable}
                aria-label={unavailable ? `${copy.label} — ${t("Server unavailable")}` : copy.label}
                autoFocus={!unavailable && entries.length === 0 && index === 0}
                data-tv-initial-focus={
                  (!unavailable && entries.length === 0 && index === 0) || undefined
                }
                onClick={() => {
                  closeLocalVersions();
                  payload.onPlayServer?.(copy);
                }}
                className="group/v flex items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors enabled:hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  {connection ? (
                    <MediaServerBrand
                      provider={connection.provider}
                      name={connection.name}
                      compact
                    />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[13.5px] text-ink">{copy.label}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-ink-muted">
                    {connection && <span className="max-w-28 truncate">{connection.name}</span>}
                    {unavailable && (
                      <span className="rounded bg-canvas px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide">
                        {status === "checking" ? t("Checking…") : t("Offline")}
                      </span>
                    )}
                    <MediaServerVersionBadges version={copy.version} filename={copy.label} />
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors group-hover/v:bg-ink group-hover/v:text-canvas">
                  <Play size={13} strokeWidth={2.4} fill="currentColor" className="ml-0.5" />
                </span>
              </button>
            );
          })}
          {payload.onStream && (
            <>
              <p className="px-3 pt-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {t("Streaming sources")}
              </p>
              <button
                type="button"
                data-bp-focusable={bigPicture || undefined}
                onClick={() => {
                  closeLocalVersions();
                  payload.onStream?.();
                }}
                className="group/v flex items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-raised"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Globe2 size={16} />
                </span>
                <span className="flex-1 text-[13.5px] text-ink">{t("Browse addon sources")}</span>
                <Play size={13} fill="currentColor" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
