import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Monitor, X } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { useT } from "@/lib/i18n";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useExitPresence } from "@/lib/use-exit-presence";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useSectionBack } from "@/lib/section-back";
import { DEFAULT_CATALOG_FILTERS, GAME_TAGS, type CatalogFilters } from "@/lib/games/catalog-filters";
import { GameMark } from "./game-ui";
import windowsLogo from "@/assets/games/platforms/windows.png";
import macosLogo from "@/assets/games/platforms/macos.png";
import "./game-catalog-filters.css";

type Group = "tags" | "platform" | "mode" | "price";
const platformLogos: Record<string, string> = { win: windowsLogo, mac: macosLogo, linux: "/games/platforms/linux.svg" };

export function GameCatalogFilters({ filters, setFilters, active, lockedTags = [] }: {
  filters: CatalogFilters;
  setFilters: (filters: CatalogFilters) => void;
  active: boolean;
  lockedTags?: readonly number[];
}) {
  const t = useT();
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const returnGroup = useRef<Group | null>(null);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [width, setWidth] = useState(() => Math.min(320, window.innerWidth - 16));
  const reduced = useReducedMotion();
  const { mounted, closing } = useExitPresence(open && active, reduced ? 0 : 160);
  const count = filters.tags.filter(tag => !lockedTags.includes(tag)).length + (filters.features?.length ?? 0) + Number(filters.platform !== "all") + Number(filters.mode !== "all") + Number(filters.price !== "all") + Number(filters.controller);
  const labels: Record<Group, string> = {
    tags: t("games.catalog.inTheMood"), platform: t("games.platforms"),
    mode: t("games.catalog.players"), price: t("games.catalog.price"),
  };
  const options = {
    platform: [{ value: "all", label: t("games.allPlatforms") }, { value: "win", label: "Windows" }, { value: "mac", label: "macOS" }, { value: "linux", label: "SteamOS / Linux" }],
    mode: ["all", "2", "1", "20", "9", "39"].map(value => ({ value, label: t(`games.catalog.mode.${value}`) })),
    price: ["all", "free", "offers"].map(value => ({ value, label: t(`games.catalog.price.${value}`) })),
  };
  const close = () => {
    if (menu.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true });
    setOpen(false);
  };
  const back = () => { returnGroup.current = group; setGroup(null); };
  const reset = () => setFilters({ ...DEFAULT_CATALOG_FILTERS, developer: filters.developer, publisher: filters.publisher, sort: filters.sort });
  useSectionBack(() => { if (group) back(); else close(); }, open && active);

  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => {
    const resize = () => setWidth(Math.min(320, window.innerWidth - 16));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!open || !mounted || closing) return;
    const destination = group ? '[aria-checked="true"]:not(:disabled), [data-option]:not(:disabled)' : returnGroup.current ? `[data-group="${returnGroup.current}"]` : "[data-group]";
    menu.current?.querySelector<HTMLElement>(destination)?.focus({ preventScroll: true });
    returnGroup.current = null;
  }, [open, mounted, closing, group]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isBackKey(event.nativeEvent)) {
      event.preventDefault(); event.stopPropagation();
      if (group) back(); else close();
      return;
    }
    if (event.key === "Tab") { close(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return <>
    <button ref={anchor} className="games-button games-filter-trigger" aria-haspopup="dialog" aria-expanded={open && active} aria-controls={mounted ? id : undefined} onClick={() => {
      if (open) close(); else { setGroup(null); returnGroup.current = null; setOpen(true); }
    }}>
      <GameMark kind="filter" size={20}/>{t("games.catalog.filters")}
      {count > 0 && <span className="games-filter-count">{count}</span>}
      <ChevronDown size={17} className="games-filter-chevron"/>
    </button>
    <AnchoredMenu anchorRef={anchor} open={mounted} onClose={close} width={width}>
      <div ref={menu} id={id} className="games-filter-popout" role="dialog" aria-label={t("games.catalog.filters")} data-closing={closing || undefined} inert={!open || !active} onKeyDown={onKeyDown}>
        <div className="games-filter-popout-heading">
          {group ? <button className="games-filter-back" onClick={back} aria-label={t("common.back")}><ArrowLeft size={16}/></button> : <GameMark kind="filter" size={17}/>}
          <strong>{group ? labels[group] : t("games.catalog.filters")}</strong>
          <button className="games-filter-dismiss" onClick={close} aria-label={t("common.close")}><X size={16}/></button>
        </div>
        <div className="games-filter-popout-options" key={group ?? "root"}>
          {!group ? <>
            {(Object.keys(labels) as Group[]).map(key => <button key={key} data-group={key} className="games-filter-row" onClick={() => setGroup(key)}>
              <span>{labels[key]}</span>
              <small>{key === "tags" ? filters.tags.length || null : filters[key] !== "all" ? options[key].find(option => option.value === filters[key])?.label : null}</small>
              <ChevronRight size={15}/>
            </button>)}
            <button className="games-filter-row" role="checkbox" aria-checked={filters.controller} onClick={() => setFilters({ ...filters, controller: !filters.controller })}>
              <span>{t("games.fullController")}</span><span className="games-filter-check">{filters.controller && <Check size={12}/>}</span>
            </button>
            {filters.features?.map(feature => <button key={feature.id} className="games-filter-row" aria-label={t("games.details.removeFeature", { name: feature.name })} onClick={() => setFilters({ ...filters, features: filters.features?.filter(item => item.id !== feature.id) })}><span>{feature.name}</span><X size={14}/></button>)}
          </> : group === "tags" ? GAME_TAGS.map(tag => <button key={tag.id} data-option className="games-filter-row" role="checkbox" disabled={lockedTags.includes(tag.id)} aria-checked={filters.tags.includes(tag.id)} onClick={() => setFilters({ ...filters, tags: filters.tags.includes(tag.id) ? filters.tags.filter(value => value !== tag.id) : [...filters.tags, tag.id] })}>
            <span>{t(`games.tag.${tag.key}`)}</span><span className="games-filter-check">{filters.tags.includes(tag.id) && <Check size={12}/>}</span>
          </button>) : options[group].map(option => <button key={option.value} data-option className="games-filter-row" role="radio" aria-checked={filters[group] === option.value} onClick={() => {
            setFilters({ ...filters, [group]: option.value }); back();
          }}><span className={group === "platform" ? "games-filter-platform-label" : undefined}>{group === "platform" && (platformLogos[option.value] ? <span className="games-filter-platform-logo" style={{ maskImage: `url("${platformLogos[option.value]}")` }} aria-hidden="true"/> : <Monitor size={18} aria-hidden="true"/>)}{option.label}</span>{filters[group] === option.value && <Check size={15}/>}</button>)}
        </div>
        {count > 0 && <button className="games-filter-reset" onClick={reset}>{t("games.catalog.reset")}</button>}
      </div>
    </AnchoredMenu>
  </>;
}
