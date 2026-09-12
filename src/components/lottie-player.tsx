import lottie, { type AnimationItem } from "lottie-web";
import { useEffect, useRef } from "react";
import { observeWithin } from "@/lib/visibility";

type Props = {
  data: object;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
};

export function LottiePlayer({ data, className, loop = true, autoplay = true, speed = 1 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop,
      autoplay: false,
      animationData: data,
    });
    animRef.current = anim;
    const total = Math.max(1, Math.floor(anim.totalFrames));
    const stepMs = 1000 / ((anim.frameRate || 30) * speed);
    let frame = 0;
    let timer = 0;
    let inView = false;
    anim.goToAndStop(0, true);
    const halt = () => {
      if (!timer) return;
      window.clearInterval(timer);
      timer = 0;
    };
    const step = () => {
      frame += 1;
      if (frame >= total) {
        if (!loop) {
          halt();
          anim.goToAndStop(total - 1, true);
          return;
        }
        frame = 0;
      }
      anim.goToAndStop(frame, true);
    };
    const sync = () => {
      if (autoplay && inView && !document.hidden) {
        if (!timer) timer = window.setInterval(step, stepMs);
      } else halt();
    };
    const stop = observeWithin(el, "0px", (e) => {
      inView = e.isIntersecting;
      sync();
    });
    document.addEventListener("visibilitychange", sync);
    return () => {
      halt();
      stop();
      document.removeEventListener("visibilitychange", sync);
      anim.destroy();
      animRef.current = null;
    };
  }, [data, loop, autoplay, speed]);

  return <div ref={ref} className={className} aria-hidden />;
}
