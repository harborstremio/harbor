import { useEffect, useState } from "react";
import { Wifi, WifiOff, BatteryCharging, CloudOff } from "lucide-react";
import { isAndroid } from "@/lib/platform";
import { useSyncQueueStale } from "@/lib/profile-sync";
import { useBpT } from "./bp-i18n";

type BatteryInfo = { level: number; charging: boolean };

type BatteryLike = {
  level: number;
  charging: boolean;
  addEventListener: (t: string, fn: () => void) => void;
  removeEventListener: (t: string, fn: () => void) => void;
};

function useBattery(): BatteryInfo | null {
  const [info, setInfo] = useState<BatteryInfo | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (typeof nav.getBattery !== "function") return;
    let battery: BatteryLike | null = null;
    let alive = true;
    const sync = () => {
      if (battery && alive) setInfo({ level: battery.level, charging: battery.charging });
    };
    nav
      .getBattery()
      .then((b) => {
        if (!alive) return;
        battery = b;
        sync();
        b.addEventListener("levelchange", sync);
        b.addEventListener("chargingchange", sync);
      })
      .catch(() => {});
    return () => {
      alive = false;
      battery?.removeEventListener("levelchange", sync);
      battery?.removeEventListener("chargingchange", sync);
    };
  }, []);

  return info;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function BatteryGlyph({ level, charging }: BatteryInfo) {
  const pct = Math.round(level * 100);
  const low = pct <= 20 && !charging;
  return (
    <span className="flex items-center gap-1.5">
      {charging ? (
        <BatteryCharging strokeWidth={2} className="h-[clamp(14px,1.9vh,22px)] w-auto text-[var(--bp-live)]" />
      ) : (
        <span
          aria-hidden
          className={`relative flex h-[13px] w-[24px] items-center rounded-[3px] border-2 p-[1.5px] ${
            low ? "border-danger" : "border-ink-muted"
          }`}
        >
          <span
            className={`block h-full rounded-[1px] ${low ? "bg-danger" : "bg-ink-muted"}`}
            style={{ width: `${Math.max(6, pct)}%` }}
          />
          <span
            className={`absolute -end-[4px] top-1/2 h-[5px] w-[2px] -translate-y-1/2 rounded-e-[1px] ${
              low ? "bg-danger" : "bg-ink-muted"
            }`}
          />
        </span>
      )}
      <span
        className={`text-[clamp(14px,1.9vh,22px)] font-semibold leading-none tabular-nums ${
          low ? "text-danger" : "text-ink-muted"
        }`}
      >
        {pct}%
      </span>
    </span>
  );
}

export function BpStatus() {
  const battery = useBattery();
  const online = useOnline();
  const t = useBpT();
  // navigator.onLine is true on a router with no upstream, so the Wifi glyph keeps
  // painting full strength while every push fails. Without this the user reorders their
  // rows here and on their phone at the same time and only finds out one was thrown
  // away later. Not shown for a push merely in flight: this is a queue stuck for a
  // minute, which is a different fact from busy.
  const stale = useSyncQueueStale();

  return (
    <span className="flex items-center gap-[clamp(9px,1vw,16px)]">
      {stale && (
        <CloudOff
          strokeWidth={2}
          aria-label={t("Changes not saved to your Harbor account yet")}
          className="h-[clamp(14px,1.9vh,22px)] w-auto text-danger"
        />
      )}
      {online ? (
        <Wifi strokeWidth={2} className="h-[clamp(14px,1.9vh,22px)] w-auto text-ink-muted" />
      ) : (
        <WifiOff strokeWidth={2} className="h-[clamp(14px,1.9vh,22px)] w-auto text-danger" />
      )}
      {battery && !isAndroid() && <BatteryGlyph {...battery} />}
    </span>
  );
}
