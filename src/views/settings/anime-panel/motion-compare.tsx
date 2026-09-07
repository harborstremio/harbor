import { useEffect, useRef, useState } from "react";
import animeFrame from "@/assets/settings-preview/harbor-coast-anime.png";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ROW_ACTION } from "../kit";
import { ROW_DESC, ROW_TITLE } from "../shared";

export function MotionCompare() {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const playing = !paused && !reducedMotion && inView && pageVisible;

  return (
    <div ref={ref} className="hset-motion-comparison pt-4" role="group" aria-label={t("Before and after")} data-paused={paused ? "" : undefined} style={{ animationPlayState: playing ? "running" : "paused" }}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={ROW_TITLE}>{t("Before and after")}</h3>
        {!reducedMotion && (
          <button type="button" className={ROW_ACTION} onClick={() => setPaused((value) => !value)}>
            {paused ? t("Play preview") : t("Pause preview")}
          </button>
        )}
      </div>
      <p className={`mt-2 ${ROW_DESC}`}>{t("The same slow camera pan, with motion smoothing off and on.")}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {[false, true].map((smooth) => (
          <figure key={String(smooth)} className="min-w-0">
            <div className="hset-motion-viewport">
              <div className="hset-motion-scene">
                <img src={animeFrame} alt="" draggable={false} className={`hset-motion-image${smooth ? "" : " hset-motion-image-original"}`} />
              </div>
            </div>
            <figcaption className={`mt-2.5 ${ROW_TITLE}`}>{smooth ? t("Smoothing on") : t("Smoothing off")}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
