import { useEffect, useId, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import type { PokemonMap } from "@/lib/games/pokemon";
import { PokemonMapImage } from "./game-pokemon-map-image";
export function PokemonMapViewer({ map, close }: { map: PokemonMap; close: () => void }) {
  const t = useT(), { closing, close: dismiss } = useModalExit(close), root = useRef<HTMLDivElement>(null), titleId=useId();
  useSectionBack(dismiss, true);
  useEffect(() => { const prior = document.activeElement as HTMLElement | null; root.current?.querySelector("button")?.focus({ preventScroll: true }); return () => { if (prior?.isConnected) prior.focus({ preventScroll: true }); }; }, []);
  return <ModalShell closing={closing} onDismiss={dismiss} width={1100} labelledBy={titleId}><div ref={root} onKeyDown={event=>{if(event.key!=="Tab")return;const items=[...event.currentTarget.querySelectorAll<HTMLElement>('button,a[href],[tabindex="0"]')], first=items[0], last=items.at(-1);if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}} className="pokemon-map-viewer" inert={closing || undefined}><header><h3 id={titleId}>{map.title}</h3><button aria-label={t("common.close")} onClick={dismiss}><X size={24}/></button></header><div tabIndex={0}><PokemonMapImage src={map.fullImage ?? map.image} alt={map.title}/></div><a href={map.url} onClick={event => { event.preventDefault(); void openUrl(map.url); }}>Bulbagarden Archives<ArrowUpRight size={16}/></a></div></ModalShell>;
}
