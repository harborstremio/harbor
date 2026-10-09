import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import {
  ScreensaverBrand,
  ScreensaverClockFace,
  useScreensaverClock,
} from "./screensaver-clock";

const CANVAS = "#0f1113";

export function HalloweenOverlay({
  reduce,
  visible,
  onDismiss,
}: {
  reduce: boolean;
  visible: boolean;
  onDismiss: () => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const anim = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);
  const { time, date } = useScreensaverClock();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ default: lottie }, { default: data }] = await Promise.all([
        import("lottie-web"),
        import("@/assets/lottie/screensaver/halloween.json"),
      ]);
      if (cancelled || !host.current) return;
      const a = lottie.loadAnimation({
        container: host.current,
        renderer: "svg",
        loop: true,
        autoplay: !reduce,
        animationData: data,
        rendererSettings: {
          progressiveLoad: false,
          preserveAspectRatio: "xMidYMid slice",
        },
      });
      anim.current = a;
      a.addEventListener("DOMLoaded", () => {
        if (!cancelled) setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      anim.current?.destroy();
      anim.current = null;
    };
  }, [reduce]);

  return (
    <div
      role="presentation"
      aria-hidden
      onPointerDown={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      className="fixed inset-0 z-[200] cursor-none select-none overflow-hidden"
      style={{
        background: CANVAS,
        opacity: visible && ready ? 1 : 0,
        transition: `opacity ${visible ? 900 : 420}ms ease-out`,
        willChange: "opacity",
      }}
    >
      <div ref={host} className="h-full w-full" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.34) 40%, rgba(0,0,0,0) 100%)",
          opacity: ready ? 1 : 0,
          transition: "opacity 900ms ease-out",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 900ms ease-out" }}
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-10">
          <ScreensaverBrand />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-8 p-12">
          <ScreensaverClockFace time={time} date={date} />
        </div>
      </div>
    </div>
  );
}
