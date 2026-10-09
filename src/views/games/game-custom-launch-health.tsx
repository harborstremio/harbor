import { RefreshCw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { customLaunchHealth, launchConfigKey } from "@/lib/games/custom-launch-health";
import type { CustomGame, LaunchConfig } from "@/lib/games/custom-library";
import type { CustomGameLibrary } from "@/hooks/use-custom-game-library";
import "./game-custom-launch-health.css";

export function CustomLaunchStatus({ game, library }: { game: CustomGame; library: CustomGameLibrary }) {
  const t = useT(), health = customLaunchHealth(game, library.health);
  return <small className="games-custom-launch-status" data-state={health?.state ?? "unknown"}>{t(health?.state === "ready" ? "games.setup.phase.ready" : `games.launchHealth.${!health && library.checking ? "checking" : health?.state ?? "unchecked"}`)}</small>;
}

export function CustomLaunchSetup({ game, library, draft }: { game: CustomGame; library: CustomGameLibrary; draft: LaunchConfig }) {
  const t = useT(), language = useUiLanguage(), health = customLaunchHealth(game, library.health);
  const changed = launchConfigKey(game.config) !== launchConfigKey(draft);
  return <section className="games-custom-launch-check" aria-label={t("games.launchHealth.repair")}>
    <div><strong>{t(`games.launchHealth.${changed ? "changed" : !health && library.checking ? "checking" : health?.state ?? "unchecked"}`)}</strong>
      <button type="button" className="games-icon-button" aria-label={t("games.launchHealth.check")} title={t("games.launchHealth.check")} disabled={library.checking || !library.available || changed} onClick={library.recheck}><RefreshCw size={16} className={library.checking ? "games-custom-working" : undefined}/></button></div>
    <p>{t(!library.available ? "games.launchHealth.desktop" : !changed && health?.issue ? `games.launchHealth.${health.issue}` : "games.launchHealth.note")}</p>
    {!changed && health && <small>{t("games.launchHealth.checked", { date: new Date(health.checkedAt).toLocaleString(language) })}</small>}
    {!changed && health?.state === "attention" && <p>{t("games.launchHealth.relocate")}</p>}
  </section>;
}
