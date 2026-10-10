import { useEffect, useState } from "react";
import { Check, FolderOpen, HardDrive, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useT } from "@/lib/i18n";
import { useArchiveSpace } from "@/hooks/use-archive-space";
import { archiveLocationChoices, type ArchiveLocation } from "@/lib/games/archive-locations";
import { setupParent, type SetupLocations } from "@/lib/games/setup-locations";
import { setupPath } from "@/lib/games/setup";
import { transferBytes } from "@/lib/games/transfers";

function Destination({ location, profile, token, selected, disabled, select }: {
  location: ArchiveLocation; profile: string; token: string; selected: boolean; disabled: boolean; select: () => void;
}) {
  const t = useT(), space = useArchiveSpace(profile, token, location.path, !disabled);
  const value = space.value, shortfall = (value?.shortfallBytes ?? 0) > 0;
  return <button type="button" className="games-archive-location" aria-pressed={selected} disabled={disabled} onClick={select}>
    {location.kind === "drive" ? <HardDrive size={22}/> : <FolderOpen size={22}/>}
    <span><strong>{location.kind === "drive" ? location.label : t(`games.archive.location.${location.kind}`)}</strong><bdi dir="ltr">{location.path}</bdi>
      <small className={shortfall ? "is-shortfall" : ""} aria-live="polite">{space.checking ? <i className="games-archive-skeleton-line"/> : value?.availableBytes != null ? <>
        {t("games.archive.space.free", { size: `\u2068${transferBytes(value.availableBytes)}\u2069` })}
        {shortfall && <> · {t("games.archive.space.shortfall", { size: `\u2068${transferBytes(value.shortfallBytes!)}\u2069` })}</>}
      </> : t("games.archive.location.unknown")}</small>
    </span><i className="games-archive-location-check">{selected && <Check size={16}/>}</i>
  </button>;
}

export function GameArchiveDestinations({ profile, token, source, recent, parent, disabled, select }: {
  profile: string; token: string; source: string; recent: string; parent: string; disabled: boolean; select: (path: string) => void;
}) {
  const t = useT(), sourceParent = setupParent(source), key = JSON.stringify([profile, recent, sourceParent]);
  const [attempt, retry] = useState(0), [state, setState] = useState<{ key: string; choices: ArchiveLocation[]; error: boolean }>();
  useEffect(() => {
    let current = true;
    setState(undefined);
    const deadline = window.setTimeout(() => { if (current) { current = false; setState({ key, choices: [], error: true }); } }, 10000);
    const load = (path: string) => invoke<SetupLocations>("games_download_locations", { parent: path || null });
    void Promise.allSettled([load(recent), recent === sourceParent ? Promise.resolve(null) : load(sourceParent)]).then(results => {
      if (!current) return;
      clearTimeout(deadline);
      const empty: SetupLocations = { drives: [], selected: null };
      const first = results[0].status === "fulfilled" ? results[0].value : null;
      const second = results[1].status === "fulfilled" ? results[1].value : null;
      setState({ key, choices: archiveLocationChoices(first ?? empty, second ?? empty), error: !first && !second });
    });
    return () => { current = false; clearTimeout(deadline); };
  }, [key, recent, sourceParent, attempt]);
  const current = state?.key === key ? state : undefined;
  return <div className="games-archive-locations" aria-busy={!current}>
    {!current ? <div className="games-archive-location-skeletons" aria-label={t("games.archive.space.checking")} role="status">{[0, 1, 2].map(index => <i key={index}><b/><span><b/><b/></span></i>)}</div> : current.error ? <p className="games-archive-locations-error">{t("games.archive.location.unavailable")}<button type="button" className="games-icon-button" disabled={disabled} aria-label={t("common.retry")} onClick={() => retry(value => value + 1)}><RefreshCw size={16}/></button></p> : <div className="games-archive-location-grid">{current.choices.map(location => <Destination key={`${token}:${location.path}`} location={location} profile={profile} token={token} selected={!!parent && setupPath(parent) === setupPath(location.path)} disabled={disabled} select={() => select(location.path)}/>)}</div>}
  </div>;
}
