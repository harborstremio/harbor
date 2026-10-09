import { useMemo, useState } from "react";
import { Maximize2, ZoomIn } from "lucide-react";
import { useT } from "@/lib/i18n";
import { helldiversFactionArt, helldiversMapLinks, helldiversMapPoint, type HelldiversCampaign, type HelldiversMapPlanet } from "@/lib/games/helldivers-data";

export function HelldiversMap({ planets, campaigns, selected, onSelect }: {
  planets: HelldiversMapPlanet[]; campaigns: HelldiversCampaign[]; selected?: HelldiversCampaign; onSelect: (id: number) => void;
}) {
  const t = useT(), [zoomed, setZoomed] = useState(false);
  const geometry = useMemo(() => {
    const latest = new Map(campaigns.map(planet => [planet.planet, planet]));
    const all = planets.map(planet => {
      const campaign = latest.get(planet.index);
      return campaign ? { ...planet, owner: campaign.owner, position: campaign.position ?? planet.position } : planet;
    });
    const sectors = new Map<string, HelldiversMapPlanet[]>();
    for (const planet of all) if (planet.sector && planet.sector !== "TBD") sectors.set(planet.sector, [...(sectors.get(planet.sector) ?? []), planet]);
    return { planets: all, links: helldiversMapLinks(all), sectors: [...sectors].map(([name, members]) => ({ name,
      point: helldiversMapPoint({ x: members.reduce((sum, planet) => sum + planet.position.x, 0) / members.length,
        y: members.reduce((sum, planet) => sum + planet.position.y, 0) / members.length }) })) };
  }, [planets, campaigns]);
  const focus = selected?.position ? helldiversMapPoint(selected.position) : { x: 250, y: 250 };
  const magnify = zoomed && !!selected?.position;
  const activeIds = new Set(campaigns.map(planet => planet.planet));
  // Zoom centers the selected front; the campaign list can move to any other front.
  const x = magnify ? Math.max(0, Math.min(250, focus.x - 125)) : 0;
  const y = magnify ? Math.max(0, Math.min(250, focus.y - 125)) : 0;
  return <div className="games-helldivers-map" role="group" aria-label={t("games.helldivers.map")}>
    <div className="games-helldivers-map-heading"><div><span>{t("games.helldivers.map")}</span>{selected?.sector && <strong dir="auto">{selected.sector}</strong>}</div>
      <button disabled={!selected?.position} aria-pressed={magnify} aria-label={t(`games.helldivers.${magnify ? "wholeMap" : "focusMap"}`)} onClick={() => setZoomed(value => !value)}>{magnify ? <Maximize2 size={17}/> : <ZoomIn size={17}/>}</button>
    </div>
    <svg className="games-helldivers-map-svg" viewBox={`${x} ${y} ${magnify ? 250 : 500} ${magnify ? 250 : 500}`} aria-label={t("games.helldivers.map")}>
      <image href="/games/helldivers/sectormap.webp" x="35" y="35" width="430" height="430" className="games-helldivers-sectors"/>
      <g className="games-helldivers-supply" aria-hidden="true">{geometry.links.map(link => {
        const a = helldiversMapPoint(link.from.position), b = helldiversMapPoint(link.to.position);
        return <line key={link.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} data-selected={link.from.index === selected?.planet || link.to.index === selected?.planet}/>;
      })}</g>
      <g aria-hidden="true">{geometry.planets.filter(planet => !activeIds.has(planet.index) && planet.index !== 0).map(planet => {
        const point = helldiversMapPoint(planet.position);
        return <circle key={planet.index} cx={point.x} cy={point.y} r="1.8" className="games-helldivers-map-planet" data-faction={planet.owner}><title>{planet.name}</title></circle>;
      })}</g>
      <g className="games-helldivers-sector-labels" aria-hidden="true">{geometry.sectors.map(sector => <text key={sector.name} x={sector.point.x} y={sector.point.y - 8} data-selected={sector.name === selected?.sector}>{sector.name.toUpperCase()}</text>)}</g>
      <image href={helldiversFactionArt("Humans")} x="241" y="241" width="18" height="18" aria-hidden="true"/>
      {campaigns.filter(planet => planet.position).map(planet => {
        const point = helldiversMapPoint(planet.position!), chosen = planet.planet === selected?.planet;
        return <g key={planet.planet} className="games-helldivers-map-pin" data-faction={planet.faction} data-selected={chosen} role="button" tabIndex={0}
          aria-pressed={chosen} aria-label={`${planet.name} · ${t(`games.helldivers.${planet.faction}`)}`} onClick={() => onSelect(planet.planet)}
          onFocus={() => { if (magnify && (point.x < x || point.x > x + 250 || point.y < y || point.y > y + 250)) setZoomed(false); }}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(planet.planet); } }}>
          <title>{planet.name}</title><circle className="games-helldivers-map-hit" cx={point.x} cy={point.y} r="9"/>
          <circle className="games-helldivers-map-dot" cx={point.x} cy={point.y} r={chosen ? 4 : 3}/>
          {chosen && <circle className="games-helldivers-map-ring" cx={point.x} cy={point.y} r="8"/>}
        </g>;
      })}
      {selected?.position && <text className="games-helldivers-map-selected" x={focus.x} y={focus.y + 18} textAnchor={focus.x > 425 ? "end" : focus.x < 75 ? "start" : "middle"}>{selected.name}</text>}
    </svg>
    <small>{t("games.helldivers.mapScope")}</small>
  </div>;
}
