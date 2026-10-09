import { useEffect, type RefObject } from "react";

/* MOTION STORYBOARD
 *   0ms  heading and section enter, 18px → 0
 *  60ms  artwork follows; subsequent cards stagger by 45ms, capped at 225ms
 * 650ms  section settles. Each section enters once, preserving Back position.
 */
export function useGameReveal(root: RefObject<HTMLElement | null>) {
  useEffect(()=>{
    const element=root.current;if(!element)return;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    const seen=new WeakSet<Element>();
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){(entry.target as HTMLElement).dataset.revealed="true";observer.unobserve(entry.target);}}, {root:element,threshold:.035,rootMargin:"0px 0px -36px 0px"});
    const scan=()=>{for(const section of element.querySelectorAll<HTMLElement>(".games-section, .games-recommendations")){if(seen.has(section))continue;seen.add(section);section.dataset.gameReveal="true";if(reduced.matches)section.dataset.revealed="true";else observer.observe(section);}};
    scan();const mutations=new MutationObserver(scan);mutations.observe(element,{childList:true,subtree:true});
    const change=()=>{if(reduced.matches)for(const section of element.querySelectorAll<HTMLElement>("[data-game-reveal]"))section.dataset.revealed="true";};reduced.addEventListener("change",change);
    return()=>{mutations.disconnect();observer.disconnect();reduced.removeEventListener("change",change);};
  },[root]);
}
