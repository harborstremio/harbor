import { LottiePlayer } from "@/components/lottie-player";
import waitingAnim from "@/assets/lottie/wt-waiting-white.json";
import { formatNames } from "./player-utils";
import type { RoomSnapshot } from "@/lib/together/client";
import { useT } from "@/lib/i18n";

function readyPillClass(ready: boolean, stale: boolean): string {
  if (ready) return "bg-emerald-500/15 text-emerald-300";
  if (stale) return "bg-amber-400/15 text-amber-300";
  return "bg-white/10 text-white/70";
}

function readyDotClass(ready: boolean, stale: boolean): string {
  if (ready) return "bg-emerald-400";
  if (stale) return "bg-amber-400";
  return "bg-white/40";
}

export function WaitingForRoom(props: {
  isHost: boolean;
  notReady: RoomSnapshot["participants"];
  participants: RoomSnapshot["participants"];
  clientId: string;
  everyoneReady: boolean;
  staleIds: Set<string>;
  guestEscapeReady: boolean;
  onStart: () => void;
  onPlayWithoutSync: () => void;
  onLeave: () => void;
}) {
  const {
    isHost,
    notReady,
    participants,
    clientId,
    everyoneReady,
    staleIds,
    guestEscapeReady,
    onStart,
    onPlayWithoutSync,
    onLeave,
  } = props;
  const t = useT();
  const stillLoading = notReady.length;
  return (
    <div
      data-tv-focus-scope
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/72 backdrop-blur-md"
    >
      <div className="flex max-w-sm flex-col items-center gap-5 px-8 text-center">
        <LottiePlayer data={waitingAnim} className="h-28 w-28" />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[18px] font-semibold text-white">
            {isHost ? t("Ready when you are") : t("Waiting for the host to start")}
          </h2>
          <p className="text-[13px] text-white/60">
            {isHost
              ? stillLoading > 0
                ? t("Loading on {names}…", { names: formatNames(notReady.map((p) => p.name)) })
                : t("Everyone is loaded in. Press play to start watching.")
              : t("The host starts playback for the whole room.")}
          </p>
        </div>
        {isHost && participants.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {participants.map((p) => {
              const stale = staleIds.has(p.id);
              return (
                <span
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] ${readyPillClass(p.ready, stale)}`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${readyDotClass(p.ready, stale)}`}
                  />
                  {p.name}
                  {p.id === clientId && t(" (you)")}
                  {!p.ready && stale && t(" · still loading")}
                </span>
              );
            })}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2.5">
          {isHost && (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {everyoneReady
                ? t("Start watching")
                : t("Start anyway ({n} still loading)", { n: stillLoading })}
            </button>
          )}
          {!isHost && guestEscapeReady && (
            <button
              type="button"
              onClick={onPlayWithoutSync}
              className="inline-flex h-10 items-center rounded-full bg-white/15 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-white/25"
            >
              {t("Play without sync")}
            </button>
          )}
          <button
            type="button"
            onClick={onLeave}
            data-tv-modal-close
            className="inline-flex h-10 items-center rounded-full border border-white/25 px-5 text-[13px] font-semibold text-white/80 transition-colors hover:border-white/45 hover:text-white"
          >
            {t("Leave")}
          </button>
        </div>
      </div>
    </div>
  );
}
