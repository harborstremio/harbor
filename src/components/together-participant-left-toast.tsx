import { useEffect } from "react";
import { useTogether } from "@/lib/together/provider";
import { Avatar } from "./together-modal/avatar";

export function TogetherParticipantLeftToast() {
  const { incomingParticipantLeft, dismissParticipantLeft, snapshot } = useTogether();

  useEffect(() => {
    if (!incomingParticipantLeft) return;
    const t = window.setTimeout(dismissParticipantLeft, 4000);
    return () => window.clearTimeout(t);
  }, [incomingParticipantLeft, dismissParticipantLeft]);

  if (!incomingParticipantLeft || snapshot.state !== "joined") return null;
  const { name, avatar, color } = incomingParticipantLeft;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[260] flex justify-center px-6">
      <div className="harbor-together-pill pointer-events-auto flex items-center gap-3 rounded-full border border-edge bg-surface/98 py-2 ps-2 pe-4 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] animate-popover-in">
        <span className="shrink-0 ps-0.5">
          <Avatar name={name} src={avatar ?? null} color={color ?? null} size={36} />
        </span>
        <span className="text-[13.5px] font-semibold text-ink">{name} left the room</span>
      </div>
    </div>
  );
}
