import { useTogether } from "@/lib/together/provider";
import { useView } from "@/lib/view";
import { useEffect, useRef, useState } from "react";

const PREF_KEY = "harbor.together.followHostExit";

type Pref = "leave" | "stay" | null;

function readPref(): Pref {
  const v = localStorage.getItem(PREF_KEY);
  return v === "leave" || v === "stay" ? v : null;
}

function writePref(v: Exclude<Pref, null>) {
  localStorage.setItem(PREF_KEY, v);
}

export function TogetherHostLeavingPrompt() {
  const { incomingHostLeaving, dismissHostLeaving, snapshot, clientId } = useTogether();
  const { exitPlayback, topKind } = useView();
  const [remember, setRemember] = useState(false);
  const triggeredRef = useRef<number | null>(null);

  const inPlayback = topKind === "player" || topKind === "picker";

  useEffect(() => {
    if (!incomingHostLeaving) {
      triggeredRef.current = null;
      setRemember(false);
      return;
    }
    if (triggeredRef.current === incomingHostLeaving.at) return;
    triggeredRef.current = incomingHostLeaving.at;

    if (!inPlayback) {
      dismissHostLeaving();
      return;
    }

    const pref = readPref();
    if (pref === "leave") {
      exitPlayback();
      dismissHostLeaving();
    } else if (pref === "stay") {
      dismissHostLeaving();
    }
  }, [incomingHostLeaving, dismissHostLeaving, exitPlayback, inPlayback]);

  if (!incomingHostLeaving) return null;
  if (!inPlayback) return null;
  if (snapshot.state !== "joined") return null;
  if (incomingHostLeaving.from === clientId) return null;
  if (readPref()) return null;

  const othersRemain = snapshot.participants.length > 2;

  const handleStay = () => {
    if (remember) writePref("stay");
    dismissHostLeaving();
  };

  const handleLeave = () => {
    if (remember) writePref("leave");
    if (inPlayback) exitPlayback();
    dismissHostLeaving();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[140] flex justify-center px-6">
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-edge bg-surface p-5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] animate-popover-in">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">
            {incomingHostLeaving.name} left the video
          </span>
          <h3 className="text-[16px] font-semibold text-ink">Follow them out?</h3>
          <p className="text-[13.5px] text-ink-muted">
            {othersRemain
              ? "You'll stay in the room either way. Keep watching with the others, or step out of the player."
              : "You'll stay in the room either way. Keep watching alone, or step out of the player."}
          </p>
        </div>

        <label className="flex select-none items-center gap-2 text-[12.5px] text-ink-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border border-edge bg-canvas accent-accent"
          />
          Remember my choice
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            className="flex-1 rounded-full border border-edge bg-elevated px-4 py-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-raised"
          >
            Leave the video
          </button>
          <button
            onClick={handleStay}
            className="flex-1 rounded-full bg-ink px-4 py-3 text-[13.5px] font-semibold text-canvas transition-colors hover:opacity-90"
          >
            Keep watching
          </button>
        </div>
      </div>
    </div>
  );
}
