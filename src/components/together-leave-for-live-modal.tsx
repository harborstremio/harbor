import { useView } from "@/lib/view";
import { Tv } from "lucide-react";
import { useEffect } from "react";

export function TogetherLeaveForLiveModal() {
  const { pendingLiveSrc, confirmLeavePartyForLive, cancelLeavePartyForLive } = useView();

  useEffect(() => {
    if (!pendingLiveSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelLeavePartyForLive();
      if (e.key === "Enter") confirmLeavePartyForLive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingLiveSrc, cancelLeavePartyForLive, confirmLeavePartyForLive]);

  if (!pendingLiveSrc) return null;
  const name = pendingLiveSrc.title || "this channel";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-6 animate-fade-in"
      onClick={cancelLeavePartyForLive}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-ink">
            <Tv size={20} strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[17px] font-semibold text-ink">Watch Live TV?</h2>
            <p className="text-[14px] leading-relaxed text-ink-muted">
              Live TV can't be synced in a watch party, so playing {name} will leave your party. Everyone else can keep
              watching together.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={cancelLeavePartyForLive}
            className="inline-flex h-11 items-center rounded-xl border border-edge px-5 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Stay in party
          </button>
          <button
            type="button"
            onClick={confirmLeavePartyForLive}
            className="inline-flex h-11 items-center rounded-xl bg-ink px-5 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Leave & watch live
          </button>
        </div>
      </div>
    </div>
  );
}
