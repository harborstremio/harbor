import type { ReactNode } from "react";
import { CircleHelp, Clock3, Gamepad2, KeyRound, ListChecks, LockKeyhole, Monitor, RefreshCw, Search, ShieldAlert, Trophy, Unplug, UserRound, WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n";

const states = {
  noClient: { title: "steam", icon: Unplug },
  clientLoad: { title: "connection", icon: Unplug },
  clientVersion: { title: "connection", icon: Unplug },
  offline: { title: "steam", icon: WifiOff },
  accountChanged: { title: "refresh", icon: UserRound },
  notOwned: { title: "access", icon: KeyRound },
  timeout: { title: "timeout", icon: Clock3 },
  unavailable: { title: "unavailable", icon: CircleHelp },
  rejected: { title: "rejected", icon: ShieldAlert },
  uncertain: { title: "refresh", icon: CircleHelp },
  platform: { title: "platform", icon: Monitor },
  invalid: { title: "selection", icon: ListChecks },
  stale: { title: "refresh", icon: RefreshCw },
  protected: { title: "protected", icon: LockKeyhole },
  expired: { title: "refresh", icon: Clock3 },
  busy: { title: "busy", icon: Clock3 },
  empty: { title: "empty", icon: Trophy },
  filtered: { title: "filtered", icon: Search },
  noGames: { title: "noGames", icon: Gamepad2 },
  library: { title: "library", icon: Unplug },
} as const;

export function AchievementStatus({ kind, message, children, compact = false, alert = false }: {
  kind: string; message: string; children?: ReactNode; compact?: boolean; alert?: boolean;
}) {
  const t = useT();
  const state = states[kind as keyof typeof states] ?? states.unavailable;
  const Icon = state.icon;
  return <section className="gam-status" data-compact={compact || undefined} data-kind={kind} role={alert ? "alert" : "status"}>
    <span className="gam-status-mark" aria-hidden="true"><Icon size={30} strokeWidth={1.6} /></span>
    <div className="gam-status-copy"><h3>{t(`games.achievementManager.status.${state.title}`)}</h3><p>{message}</p>
      {children && <div className="gam-status-actions">{children}</div>}
    </div>
  </section>;
}
