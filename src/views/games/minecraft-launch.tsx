import { Play } from "@/components/icons/play-filled";
import { RefreshCw, Terminal } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { useMinecraftLaunch } from "@/hooks/use-minecraft-launch";
import "./minecraft-launch.css";

const k = (key: string) => `games.minecraft.launch.${key}`;
export function MinecraftLaunchStatus({ launch, required }: { launch: ReturnType<typeof useMinecraftLaunch>; required: number }) {
  const t = useT(), session = launch.state?.session;
  return <div className="mc-launch-status">
    {launch.busy && <div className="mc-pack-progress" role="status"><span>{t(k(`phase.${launch.progress?.phase ?? "metadata"}`))}</span>{launch.progress?.phase === "files" && launch.progress.total > 0 ? <><progress value={launch.progress.checked} max={launch.progress.total} /><small>{t("games.minecraft.runtime.progress", { done: launch.progress.checked, total: launch.progress.total })}</small></> : <progress />}</div>}
    {launch.state?.running && <div className="mc-launch-running" role="status"><Play size={23} className="mc-launch-running-icon"/><div><h3>{t(k("running"))}</h3><p>{t(k("closeNote"))}</p></div></div>}
    {!launch.busy && session?.endedAt && <p className="mc-launch-exit" role="status">{t(k(session.exitCode === 0 ? "finished" : session.exitCode === null ? "ended" : "failed"), { code: session.exitCode ?? "" })}</p>}
    {(launch.error || launch.readError) && <div className="mc-instance-error" role="alert">{t(launch.error || launch.readError, { version: required })}{launch.readError && <button className="games-button" onClick={launch.retry}><RefreshCw size={16} />{t("common.retry")}</button>}</div>}
    {session && <details className="mc-launch-log" open={launch.logs} onToggle={e => { if (e.currentTarget.open !== launch.logs) launch.setLogs(e.currentTarget.open); }}><summary><Terminal size={16} />{t(k("log"))}</summary>{launch.logs && <pre tabIndex={0} aria-label={t(k("log"))} dir="ltr">{launch.state?.log || t(k("noLog"))}</pre>}</details>}
  </div>;
}
