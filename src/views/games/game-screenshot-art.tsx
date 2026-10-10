import { useEffect, useRef, useState } from "react";
import { useGameScreenshot } from "@/hooks/use-game-screenshot";

/** Only mounted/nearby screenshots enter the shared image cache queue. */
export function GameScreenshotArt({ src, alt = "", className = "", active = true }: { src: string; alt?: string; className?: string; active?: boolean }) {
  const ref = useRef<HTMLImageElement>(null), [visible, setVisible] = useState(false);
  const image = useGameScreenshot(src, active && visible);
  useEffect(() => {
    const node = ref.current; if (!node || !active) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "180px" });
    observer.observe(node); return () => observer.disconnect();
  }, [src, active]);
  return <img ref={ref} className={`${className}${image.failed ? " games-art-empty" : ""}`} src={image.url || undefined} alt={image.url ? alt : ""} data-screenshot-source={src} aria-busy={!image.url&&!image.failed} decoding="async" loading="lazy" onError={image.fail}/>;
}
