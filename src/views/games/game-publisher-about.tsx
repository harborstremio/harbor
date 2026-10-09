import { Play } from "@/components/icons/play-filled";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pause } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { openUrl } from "@/lib/window";
import { sanitizePublisherHtml } from "@/lib/games/publisher-html";

export function GamePublisherAbout({ html, text, active, suspended, expanded, onExpandChange }: { html?: string; text: string; active: boolean; suspended: boolean; expanded: boolean; onExpandChange: (expanded: boolean) => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), region = useRef<HTMLDivElement>(null), reduced = useReducedMotion();
  const markup = useMemo(() => html ? sanitizePublisherHtml(html) : "", [html]);
  const content = useMemo(() => ({ __html: markup }), [markup]);
  const [motion, setMotion] = useState<boolean | null>(null);
  const [height, setHeight] = useState(0);
  const clipped = height > 450 && !expanded;
  const animate = motion ?? !reduced;
  const hasClips = markup.includes("<video");
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setHeight(node.scrollHeight);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, [markup, text]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const links = [...node.querySelectorAll<HTMLAnchorElement>("a[href]")];
    const top = node.getBoundingClientRect().top;
    links.forEach(link => { if (clipped && link.getBoundingClientRect().bottom > top + 350) link.tabIndex = -1; else link.removeAttribute("tabindex"); });
  }, [clipped, height]);
  useEffect(() => {
    const clips = [...root.current?.querySelectorAll<HTMLVideoElement>("video") ?? []];
    const visible = new Set<HTMLVideoElement>();
    const update = (clip: HTMLVideoElement) => {
      if (!active || suspended || !animate || document.hidden || !visible.has(clip)) { clip.pause(); return; }
      clip.muted = true;
      let loaded = false;
      for (const source of [clip, ...clip.querySelectorAll("source")]) {
        if (source.dataset.src && !source.getAttribute("src")) { source.setAttribute("src", source.dataset.src); loaded = true; }
      }
      if (loaded) clip.load();
      void clip.play().catch(() => {});
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const clip = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && entry.intersectionRatio >= .15) visible.add(clip); else visible.delete(clip);
      update(clip);
    }), { threshold: [0, .15] });
    const visibility = () => clips.forEach(update);
    clips.forEach(clip => observer.observe(clip)); document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); clips.forEach(clip => clip.pause()); };
  }, [markup, active, suspended, animate, expanded]);
  return <div ref={region} className="games-publisher-about" data-clipped={clipped}>
    {hasClips && <div className="games-publisher-tools"><HoverTooltip label={t(animate ? "games.details.pauseAnimations" : "games.details.playAnimations")}><button className="games-publisher-motion" aria-label={t(animate ? "games.details.pauseAnimations" : "games.details.playAnimations")} aria-pressed={animate} onClick={() => setMotion(!animate)}>{animate ? <Pause size={14}/> : <Play size={14}/>}</button></HoverTooltip></div>}
    <div id={id} className="games-publisher-viewport" style={{ maxHeight: clipped ? 420 : height || 420 }}>
    {markup ? <div ref={root} className="games-publisher-content" dangerouslySetInnerHTML={content} onClick={event => {
      const link = (event.target as Element).closest("a");
      if (link?.href) { event.preventDefault(); openUrl(link.href); }
    }}/> : <div ref={root} className="games-publisher-fallback">{text}</div>}
    </div>
    {height > 450 && <button className="games-publisher-expand" aria-expanded={expanded} aria-controls={id} onClick={() => {
      if (expanded && region.current && region.current.getBoundingClientRect().top < 0) region.current.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
      onExpandChange(!expanded);
    }}>{t(expanded ? "games.details.showLess" : "games.details.showMore")}{expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>}
  </div>;
}
