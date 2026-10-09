import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { musicGenre } from "@/lib/music/genre-catalog";

export function MusicPlaylistGenres({ genres, selected, onSelect }: {
  genres: number[];
  selected: number | null;
  onSelect: (genre: number | null) => void;
}) {
  const t = useT();
  const rail = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<(number | null)[][]>([]);
  const [edges, setEdges] = useState({ back: false, next: false });
  const read = () => {
    const node = rail.current;
    if (!node) return;
    const offset = Math.abs(node.scrollLeft);
    const back = offset > 1, next = offset + node.clientWidth < node.scrollWidth - 1;
    setEdges(current => current.back === back && current.next === next ? current : { back, next });
  };
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    const layout = () => {
      const available = node.clientWidth - 8;
      if (available <= 0) return;
      const ids = [null, ...genres];
      const widths = [...(measure.current?.children ?? [])].map(child => child.getBoundingClientRect().width);
      const next: (number | null)[][] = [[]];
      let used = 0;
      ids.forEach((id, index) => {
        const width = Math.min(widths[index] ?? available, available);
        if (used && used + 8 + width > available) { next.push([]); used = 0; }
        next[next.length - 1].push(id);
        used += (used ? 8 : 0) + width;
      });
      setPages(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      read();
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(node);
    if (measure.current) observer.observe(measure.current);
    return () => observer.disconnect();
  }, [genres]);
  useLayoutEffect(read, [pages]);
  const scroll = (direction: number) => {
    const node = rail.current;
    if (!node) return;
    const page = Math.round(Math.abs(node.scrollLeft) / node.clientWidth);
    node.scrollTo({ left: Math.max(0, Math.min(pages.length - 1, page + direction)) * node.clientWidth * (getComputedStyle(node).direction === "rtl" ? -1 : 1),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const label = (id: number | null) => id === null ? t("music.filter.all") : musicGenre(id)?.name;
  return <div className="music-playlist-genres" role="group" aria-label={t("music.playlistTools.showGenres")}>
    <button className="music-playlist-tools-icon" type="button" aria-label={t("music.playlistTools.previous")} aria-disabled={!edges.back} onClick={() => { if (edges.back) scroll(-1); }}><ChevronLeft size={16} /></button>
    <div ref={rail} className="music-playlist-genre-scroll" onScroll={read}>
      {pages.map((page, index) => <div key={index} className="music-playlist-genre-page">
        {page.map(id => <button key={id ?? "all"} type="button" className="music-playlist-genre-pill" aria-pressed={selected === id} onClick={() => onSelect(id)}>{label(id)}</button>)}
      </div>)}
    </div>
    <div ref={measure} className="music-playlist-genre-measure" aria-hidden="true" inert>
      {[null, ...genres].map(id => <span key={id ?? "all"} className="music-playlist-genre-pill">{label(id)}</span>)}
    </div>
    <button className="music-playlist-tools-icon" type="button" aria-label={t("music.playlistTools.next")} aria-disabled={!edges.next} onClick={() => { if (edges.next) scroll(1); }}><ChevronRight size={16} /></button>
  </div>;
}
