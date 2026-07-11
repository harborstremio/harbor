import { ImdbIcon } from "@/components/icons/imdb-icon";
import { Star } from "lucide-react";

export function EpisodeRatingBadge({ value, isImdb }: { value: number; isImdb: boolean }) {
  return (
    <>
      {isImdb ? (
        <ImdbIcon className="h-3.5 w-auto rounded-[2px] shadow-sm" />
      ) : (
        <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" strokeWidth={0} />
      )}
      <span className="text-[12px] font-bold text-white">{value.toFixed(1)}</span>
    </>
  );
}
