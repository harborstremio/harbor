import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";
import { MOD_GAMES, type ModGameId } from "@/lib/games/mod-workspace";
import { ModGameLogo, ModImage, ModsIcon } from "./mod-workspace-parts";

export function ModsGameHeader({ game: selected, active, change }: { game: ModGameId; active: boolean; change: (game: ModGameId, origin: HTMLElement) => void }) {
  const t = useT(), id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), game = MOD_GAMES.find(value => value.id === selected)!;
  const close = (restore = false) => { setOpen(false); if (restore) trigger.current?.focus({ preventScroll: true }); };
  useSectionBack(() => close(true), active && open, true);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus({ preventScroll: true }));
    const onBack = (event: KeyboardEvent) => { if (isBackKey(event)) { event.preventDefault(); event.stopImmediatePropagation(); close(true); } };
    window.addEventListener("keydown", onBack, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onBack, true); };
  }, [open]);
  return <header className="mods-game-hero games-inset">
    <ModImage key={game.id} src={game.art} eager className="mods-game-hero-art"/>
    <div className="mods-game-identity"><ModGameLogo game={game.id}/><span><h2 tabIndex={-1}>{game.name}</h2><p>{t(`games.modHub.${game.id === "minecraft" ? "minecraft" : "sims4"}Note`)}</p></span></div>
    <button ref={trigger} className="mods-game-switch" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}><ModsIcon size={24}/><span>{t("games.modHub.switchGame")}</span><ChevronDown size={19}/></button>
    <AnchoredMenu anchorRef={trigger} open={active && open} onClose={() => close(!!menu.current?.contains(document.activeElement))} width={320} backdrop={false}>
      <div id={id} ref={menu} className="mods-game-menu" role="menu" aria-label={t("games.modHub.chooseGame")} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) close(); }} onKeyDown={event => {
        const dir = getDirection(event.nativeEvent); if (dir !== "up" && dir !== "down" && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault(); event.stopPropagation();
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")], at = items.indexOf(document.activeElement as HTMLButtonElement);
        items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (at + (dir === "down" ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
      }}>{MOD_GAMES.map(value => <button key={value.id} role="menuitemradio" aria-checked={value.id === selected} onClick={() => { close(true); if (value.id !== selected && trigger.current) change(value.id, trigger.current); }}><ModGameLogo game={value.id} compact decorative/><span>{value.name}{value.edition && <small>{value.edition}</small>}</span>{value.id === selected && <Check size={17}/>}</button>)}</div>
    </AnchoredMenu>
  </header>;
}
