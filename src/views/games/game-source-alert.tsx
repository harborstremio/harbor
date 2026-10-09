import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useSourceAlerts } from "@/hooks/use-source-alerts";
import { setSourceAlert } from "@/lib/games/source-alerts";
import type { GameSummary } from "@/lib/games/types";
import "./game-source-alert.css";

export function GameSourceAlert({ game, profile, compact = false, hasSources = true }: { game: GameSummary; profile: string; compact?: boolean; hasSources?: boolean }) {
  const t = useT(), state = useSourceAlerts(profile), watch = state.watches.find(item => item.game.id === game.id);
  const [error, setError] = useState("");
  const enabled = !!watch, found = watch?.foundAt !== undefined;
  const label = t(enabled ? "games.sourceAlerts.stop" : "games.sourceAlerts.enable");
  const note = state.error ? "games.sourceAlerts.storage" : !hasSources ? "games.sourceAlerts.noSources" : found ? "games.sourceAlerts.foundNote" : watch?.failed ? "games.sourceAlerts.retryNote" : "games.sourceAlerts.note";
  const toggle = () => {
    setError("");
    try {
      setSourceAlert(profile, game, !enabled);
      // Only this explicit opt-in may request OS permission; denial still keeps in-app alerts.
      if (!enabled) void import("@/lib/calendar").then(module => module.ensureDesktopNotifyPermission()).catch(() => {});
    } catch (error) { setError(error instanceof Error && error.message === "source_alert_limit" ? "games.sourceAlerts.limit" : "games.sourceAlerts.storage"); }
  };
  const Icon = enabled ? BellRing : Bell;
  const button = <button type="button" className={compact ? "games-detail-icon-action" : "games-button games-source-alert-button"} aria-label={label} aria-pressed={enabled} disabled={state.error} onClick={toggle}><Icon size={compact ? 27 : 20}/>{!compact && <span>{t(found ? "games.sourceAlerts.found" : enabled ? "games.sourceAlerts.on" : "games.sourceAlerts.enable")}</span>}</button>;
  return <div className={compact ? "games-source-alert is-compact" : "games-source-alert"}>
    {compact ? <HoverTooltip label={label} sublabel={t(note)}>{button}</HoverTooltip> : button}
    {!compact && <p className="games-source-alert-note" role="status">{t(error || note)}</p>}
    {compact && error && <span className="games-source-alert-error" role="alert">{t(error)}</span>}
  </div>;
}
