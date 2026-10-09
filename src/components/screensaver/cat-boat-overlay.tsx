import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";

const CANVAS = "#223bba";


export function CatBoatOverlay({
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ default: lottie }, { default: data }] = await Promise.all([
        import("lottie-web"),
        import("@/assets/lottie/screensaver/cat-boat.json"),
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
      <span
        className="pointer-events-none absolute bottom-6 left-7 flex flex-col gap-[3px] text-[13px] font-medium leading-tight tracking-wide text-white"
        style={{ opacity: ready ? 0.55 : 0, transition: "opacity 900ms ease-out" }}
      >
        <span>Illustration by Abiyyu</span>
        <span>@stass_motion</span>
      </span>
    </div>
  );
}
