import { useTogether } from "@/lib/together/provider";
import { useEffect } from "react";

export function TogetherParticipantLeftToast() {
  const { incomingParticipantLeft, dismissParticipantLeft, snapshot } = useTogether();

  useEffect(() => {
    if (!incomingParticipantLeft) return;
    const t = window.setTimeout(dismissParticipantLeft, 4000);
    return () => window.clearTimeout(t);
  }, [incomingParticipantLeft, dismissParticipantLeft]);

  if (!incomingParticipantLeft || snapshot.state !== "joined") return null;
  const { name } = incomingParticipantLeft;
  const hue = nameHue(name);
  const tint = `oklch(0.78 0.13 ${hue})`;
  const initial = (name.trim()[0] || "?").toUpperCase();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[125] flex justify-center px-6">
      <div className="harbor-together-pill pointer-events-auto flex items-center gap-3 rounded-full border border-edge bg-surface/98 py-2 ps-2 pe-4 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] animate-popover-in">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-canvas"
          style={{ backgroundColor: tint }}
        >
          {initial}
        </span>
        <span className="text-[13.5px] font-semibold text-ink">{name} left the room</span>
      </div>
    </div>
  );
}

function nameHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
