import { useEffect, useState } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";

export function useScreensaverClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return {
    time: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    date: now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  };
}

export function ScreensaverBrand() {
  return (
    <div className="flex items-center gap-2">
      <HarborMark className="h-7 w-7 shrink-0 text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]" />
      <span className="font-display text-[26px] font-semibold tracking-tight text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
        Harbor
      </span>
    </div>
  );
}

export function ScreensaverClockFace({ time, date }: { time: string; date: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[15px] font-medium uppercase tracking-[0.22em] text-white/60 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
        {date}
      </span>
      <span className="mt-1 text-[92px] font-light leading-none tabular-nums text-white drop-shadow-[0_6px_28px_rgba(0,0,0,0.75)]">
        {time}
      </span>
    </div>
  );
}
