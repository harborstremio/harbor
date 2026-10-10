import { useEffect, useState } from "react";
import jlMark from "@/assets/brand/jl-mark.webp";
import { defaultAvatarFor } from "@/lib/avatars/default-avatar";

/**
 * Fallback picture for a profile or account without one. With a seed it shows a
 * stable JL avatar for that seed; without one, or if that image fails, the JL mark.
 */
export function DefaultAvatar({ seed, className }: { seed?: string | null; className?: string }) {
  const pick = defaultAvatarFor(seed);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [pick]);

  if (pick && !failed) {
    return (
      <img
        src={pick}
        alt=""
        draggable={false}
        className={`${className ?? ""} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`${className ?? ""} flex items-center justify-center bg-[#0b0b0d]`}>
      <img src={jlMark} alt="" draggable={false} className="h-[62%] w-[62%] object-contain" />
    </span>
  );
}
