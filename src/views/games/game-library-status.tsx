import { useId } from "react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { LIBRARY_PLAY_STATUSES, LIBRARY_STATUS_FILTERS, type LibraryPlayStatus, type LibraryStatusFilter as StatusFilter } from "@/lib/games/library-status";
import { useGameLibraryPreferences, type GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import "./game-library-status.css";

export function LibraryStatusFilter({value="all",onChange}:{value?:StatusFilter;onChange:(value:StatusFilter)=>void}) {
  const t=useT();
  return <Dropdown value={value} onChange={value=>onChange(value as StatusFilter)} size="sm" ariaLabel={t("games.libraryStatus.title")}
    options={LIBRARY_STATUS_FILTERS.map(value=>({value,label:t(`games.libraryStatus.${value}`)}))}/>;
}

export function LibraryStatusSetting({id,preferences}:{id:string;preferences:GameLibraryPreferences}) {
  const t=useT(), note=useId();
  return <fieldset className="games-library-status-setting" disabled={!preferences.ready||preferences.busy} aria-describedby={note}>
    <legend>{t("games.libraryStatus.title")}</legend>
    <Dropdown value={preferences.get(id).playStatus??"unset"} ariaLabel={t("games.libraryStatus.title")}
      options={LIBRARY_PLAY_STATUSES.map(value=>({value,label:t(`games.libraryStatus.${value}`)}))}
      onChange={value=>{if(preferences.ready&&!preferences.busy)void preferences.update([id],{playStatus:value as LibraryPlayStatus});}}/>
    <p id={note}>{t("games.libraryStatus.note")}</p>
  </fieldset>;
}

/** Local installations share the same per-profile preference authority as Steam and ROMs. */
export function CustomLibraryStatusSetting({id,profile}:{id:string;profile:string}) {
  const preferences=useGameLibraryPreferences(profile,true),t=useT();
  return <><LibraryStatusSetting id={`custom:${id}`} preferences={preferences}/>{preferences.error&&<div className="games-library-preference-error" role="alert"><span>{t(preferences.error)}</span><button className="games-button" onClick={preferences.refresh}>{t("common.retry")}</button></div>}</>;
}
