import { Star } from "lucide-react";
import { Poster } from "@/components/poster";

export function RatingPoster({
  title,
  posterUrl,
  score,
  onOpen,
}: {
  title: string;
  posterUrl?: string;
  score: number;
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="group block w-full text-start disabled:cursor-default"
    >
      <div className="relative">
        <Poster
          src={posterUrl || undefined}
          seed={title}
          ratio="portrait"
          lazy
          className="rounded-md ring-1 ring-edge-soft transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:-translate-y-1"
        />
        <span className="pointer-events-none absolute end-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
          <Star size={10} className="fill-white text-white" />
          <span className="tabular-nums">{score}</span>
        </span>
      </div>
      {title && <div className="mt-1.5 line-clamp-2 text-[12px] text-ink-muted">{title}</div>}
    </button>
  );
}
