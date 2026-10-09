import { Check, FolderOpen } from "lucide-react";
import { GameFileIcon } from "./game-file-icon";
import { useT } from "@/lib/i18n";
import "./game-archive-motion.css";

/** Decorative motion follows the native phase; no simulated progress or made-up file count. */
export function ArchiveMotion({ phase, name, active = true }: { phase: "checking" | "extracting" | "publishing" | "complete"; name: string; active?: boolean }) {
  return <div className="games-archive-motion" data-phase={phase} data-active={active} aria-hidden="true">
    <div className="games-archive-motion-source"><GameFileIcon name={name}/></div>
    <div className="games-archive-motion-track"><i/><i/><i/></div>
    <div className="games-archive-motion-folder"><FolderOpen size={52} strokeWidth={1.2}/>{phase === "complete" && <Check size={19}/>}</div>
  </div>;
}

export function ArchiveReviewSkeleton() {
  const t = useT();
  return <div className="games-archive-review-skeleton" role="status" aria-label={t("games.archive.phase.checking")}>
    <div className="games-archive-metrics">{[0, 1, 2].map(index => <div key={index}><i/><i/></div>)}</div>
    <div className="games-archive-skeleton-contents"><i/></div>
    <div className="games-archive-skeleton-destination"><i/><div className="games-archive-location-skeletons">{[0, 1, 2].map(index => <i key={index}><b/><span><b/><b/></span></i>)}</div><b/><b/></div>
  </div>;
}
