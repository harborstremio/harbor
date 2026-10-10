import { useState } from "react";
import { CalendarDays, ArrowUpRight, Languages } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { AtlasGame } from "@/lib/games/igdb-data";
import type { GameRelease } from "@/lib/games/release-data";
import { DetailDisclosure } from "./game-detail-disclosure";
import "./game-release-details.css";

const regionCodes: Record<string, string> = { australia: "AU", new_zealand: "NZ", japan: "JP", china: "CN", korea: "KR", brazil: "BR" };
const areaKeys: Record<string, string> = { europe: "games.roms.regionEurope", north_america: "games.roms.regionNorthAmerica", asia: "games.roms.regionAsia", worldwide: "games.roms.regionWorldwide" };
function regionLabel(release: GameRelease, locale: string, t: ReturnType<typeof useT>) {
  const name = release.region?.name; if (!name) return "";
  if (areaKeys[name]) return t(areaKeys[name]);
  const code = regionCodes[name]; return code ? new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? name : name.replaceAll("_", " ");
}
function releaseDate(release: GameRelease, locale: string) {
  // A year-only or month-only source must not become a fictitious precise day.
  if (release.date === undefined || release.dateFormat === undefined || release.dateFormat > 2) return release.label;
  return new Intl.DateTimeFormat(locale, { year: "numeric", ...(release.dateFormat < 2 ? { month: "short" } : {}), ...(release.dateFormat === 0 ? { day: "numeric" } : {}), timeZone: "UTC" }).format(release.date * 1000);
}
export function GameReleaseDetails({ game }: { game: AtlasGame }) {
  const t = useT(), locale = useUiLanguage();
  const [platform, setPlatform] = useState("all"), [expanded, setExpanded] = useState(false);
  const history = game.releaseHistory ?? [], aliases = game.alternativeTitles ?? [];
  const platforms = [...new Map(history.map(release => [release.platform.id, release.platform])).values()];
  const releases = history.filter(release => platform === "all" || String(release.platform.id) === platform);
  return <>
    {history.length > 0 && <DetailDisclosure title={t("games.roms.releaseHistory")} icon={<CalendarDays size={22}/>} note={t("games.roms.releaseCount", { count: history.length })} className="games-release-history">
      {platforms.length > 1 && <Dropdown size="sm" ariaLabel={t("games.roms.console")} value={platform} onChange={value => { setPlatform(value); setExpanded(false); }} options={[{ value: "all", label: t("games.roms.allPlatforms") }, ...platforms.map(item => ({ value: String(item.id), label: item.name }))]}/>}
      <ol>{releases.slice(0, expanded ? releases.length : 5).map(release => <li key={release.id}>
        <div><strong>{release.platform.name}</strong><span>{regionLabel(release, locale, t)}{release.status && release.status.id !== 6 ? ` · ${release.status.name}` : ""}</span></div>
        <time>{releaseDate(release, locale) || t("games.roms.dateUnknown")}</time>
      </li>)}</ol>
      {releases.length > 5 && <button className="games-detail-text-button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t(expanded ? "games.roms.fewerReleases" : "games.roms.moreReleases")}</button>}
      <a className="games-release-source" href={game.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(game.url); }}>IGDB<ArrowUpRight size={12}/></a>
    </DetailDisclosure>}
    {aliases.length > 0 && <DetailDisclosure title={t("games.roms.alternativeTitles")} icon={<Languages size={22}/>} className="games-release-aliases">
      <ul>{aliases.map(alias => <li key={alias.name}><bdi>{alias.name}</bdi>{alias.comment && <small>{alias.comment}</small>}</li>)}</ul>
    </DetailDisclosure>}
  </>;
}
