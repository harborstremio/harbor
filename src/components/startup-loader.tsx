import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HarborLoader } from "@/components/harbor-loader";

export function StartupLoader({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const [animationReady, setAnimationReady] = useState(false);
  const handleAnimationReady = useCallback(() => setAnimationReady(true), []);
  const host = document.getElementById("harbor-boot");

  useEffect(() => {
    if (!host || !ready || !animationReady) return;
    const frame = requestAnimationFrame(onComplete);
    return () => cancelAnimationFrame(frame);
  }, [animationReady, host, onComplete, ready]);

  if (!host) return null;
  return createPortal(<HarborLoader size="lg" onReady={handleAnimationReady} />, host);
}
