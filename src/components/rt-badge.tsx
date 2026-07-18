import { RtFresh } from "./icons/rt-fresh";
import { RtRotten } from "./icons/rt-rotten";

export function RtBadge({ score, className }: { score: number; className?: string }) {
  const fresh = score >= 60;
  return fresh ? <RtFresh className={className} /> : <RtRotten className={className} />;
}
