import { useEffect, useState } from "react";
import { ArrowUpCircle, Check, Download, Loader2, RefreshCw, RotateCw, X } from "lucide-react";
import {
  closeUpdatePanel,
  downloadUpdate,
  installUpdate,
  dismissUpdate,
  checkForUpdate,
  openManualDownload,
  openHandoffDownload,
  useUpdate,
} from "@/lib/updater/use-update";
import { releaseNote, type ReleaseNote } from "@/lib/updater/release-notes";
import { useT } from "@/lib/i18n";
import { RichNote } from "./rich-notes";

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UpdateCard() {
  const t = useT();
  const u = useUpdate();
  const [shown, setShown] = useState(false);
  const [rich, setRich] = useState<ReleaseNote | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    let ok = true;
    if (u.status === "available" && u.version) {
      releaseNote(u.version).then((n) => ok && setRich(n));
    } else {
      setRich(null);
    }
    return () => {
      ok = false;
    };
  }, [u.status, u.version]);

  const pct = Math.round(u.progress * 100);
  const determinate = u.totalBytes > 0;

  return (
    <div
      className={`fixed bottom-5 end-5 z-[120] w-[372px] max-w-[calc(100vw-2.5rem)] transition-all duration-300 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            {u.status === "installing" ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <ArrowUpCircle size={22} strokeWidth={2} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold text-ink">
              {u.status === "downloaded"
                ? t("update.ready")
                : u.status === "installing"
                  ? t("update.installing")
                  : u.status === "downloading"
                    ? t("update.downloading")
                    : u.status === "error"
                      ? u.installFailed
                        ? t("Finish updating Harbor")
                        : t("update.failed")
                      : t("update.available")}
            </span>
            {u.version && (
              <span className="text-[12.5px] text-ink-subtle">
                {t("update.harborVersion", { version: u.version })}
              </span>
            )}
          </div>
          {u.status !== "installing" && u.status !== "downloading" && (
            <button
              onClick={closeUpdatePanel}
              aria-label={t("common.close")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {u.handoff && u.status !== "error" && (
          <p className="mx-5 mb-2 text-[12px] leading-relaxed text-ink-subtle">
            {u.handoff.verifiable
              ? t(
                  "This one also replaces Harbor's bundled players and tools, so it installs through Harbor Setup. Harbor closes, the installer finishes, then Harbor reopens.",
                )
              : t(
                  "This one installs through Harbor Setup, but the update manifest carries no signature for it. Harbor will not run an installer it cannot verify. Download it and run it yourself.",
                )}
          </p>
        )}

        {u.status === "available" && (rich || u.notes) && (
          <div className="mx-5 mb-1 max-h-[248px] overflow-y-auto rounded-xl border border-edge-soft/60 bg-canvas/40 px-3.5 py-3">
            {rich ? (
              <RichNote note={rich} />
            ) : (
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">
                {u.notes?.trim()}
              </p>
            )}
          </div>
        )}

        {(u.status === "downloading" || u.status === "downloaded") && (
          <div className="px-5 pb-1">
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full bg-accent transition-[width] duration-300 ${
                  u.status === "downloading" && !determinate ? "w-2/5 animate-pulse" : ""
                }`}
                style={determinate ? { width: `${Math.max(4, pct)}%` } : undefined}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-ink-subtle">
              <span>
                {u.status === "downloaded"
                  ? t("update.downloadComplete")
                  : determinate
                    ? t("update.of", {
                        downloaded: mb(u.downloadedBytes),
                        total: mb(u.totalBytes),
                      })
                    : t("update.fetching")}
              </span>
              {u.status === "downloading" && determinate && <span>{pct}%</span>}
            </div>
          </div>
        )}

        {u.status === "error" && (
          <div className="mx-5 mb-1 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-muted">
            {u.error ?? t("update.errorServer")}
            {u.installFailed && (
              <span className="mt-1.5 block text-ink-subtle">
                {t(
                  "Download and run the installer to finish updating. If it keeps failing, run it as administrator once.",
                )}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-3">
          {u.status === "available" && (
            <>
              <GhostButton onClick={dismissUpdate}>{t("update.later")}</GhostButton>
              <PrimaryButton onClick={() => void downloadUpdate()}>
                <Download size={16} strokeWidth={2.2} />{" "}
                {u.handoff && !u.handoff.verifiable
                  ? t("Download installer")
                  : t("update.download")}
              </PrimaryButton>
            </>
          )}
          {u.status === "downloaded" && (
            <>
              <GhostButton onClick={dismissUpdate}>{t("update.later")}</GhostButton>
              <PrimaryButton onClick={() => void installUpdate()}>
                <RotateCw size={16} strokeWidth={2.2} />{" "}
                {u.handoff ? t("Install and reopen") : t("update.installRestart")}
              </PrimaryButton>
            </>
          )}
          {u.status === "installing" && (
            <span className="text-[12px] text-ink-subtle">
              {u.handoff
                ? t("Harbor is closing. Harbor Setup will finish and reopen it.")
                : t("update.restartAuto")}
            </span>
          )}
          {u.status === "error" && (
            <>
              <GhostButton onClick={closeUpdatePanel}>{t("common.close")}</GhostButton>
              {u.installFailed ? (
                <PrimaryButton
                  onClick={() => void (u.handoff ? openHandoffDownload() : openManualDownload())}
                >
                  <Download size={16} strokeWidth={2.2} /> {t("Download installer")}
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => void checkForUpdate(true)}>
                  <RefreshCw size={16} strokeWidth={2.2} /> {t("update.tryAgain")}
                </PrimaryButton>
              )}
            </>
          )}
          {u.status === "downloading" && (
            <span className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
              <Check size={14} strokeWidth={2.4} className="text-accent" /> {t("update.keepUsing")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-canvas transition-[filter] hover:brightness-105"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 items-center rounded-xl px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
