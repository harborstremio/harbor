import lottie, { type AnimationItem } from "lottie-web";
import { useCallback, useEffect, useRef, useState } from "react";
import whiteBoat from "@/assets/lottie/addons-boat-white.json";
import darkBoat from "@/assets/lottie/addons-boat-dark.json";
import harborBoat from "@/assets/lottie/harbor-loader.json";
import {
  prefetchTopAddonLogos,
  prefetchedTopAddonLogos,
} from "@/lib/providers/addon-logo-prefetch";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-20 w-20",
  md: "h-32 w-32",
  lg: "h-44 w-44",
  xl: "h-60 w-60",
};

const XLINK = "http://www.w3.org/1999/xlink";

function darkBackground(): boolean {
  if (typeof document === "undefined") return true;
  const probe = document.createElement("div");
  probe.style.cssText =
    "background-color:var(--color-canvas);position:absolute;opacity:0;pointer-events:none";
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).backgroundColor.match(/[\d.]+/g);
  probe.remove();
  if (!m || m.length < 3) return true;
  const [r, g, b] = m.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function useTopAddonLogos(enabled: boolean): string[] {
  const [logos, setLogos] = useState<string[]>(() => (enabled ? prefetchedTopAddonLogos() : []));
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    prefetchTopAddonLogos().then((urls) => {
      if (!cancelled) setLogos(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return logos;
}

export function HarborLoader({
  size = "md",
  caption,
  className = "",
  keyed = false,
  logos,
  onReady,
}: {
  size?: Size;
  caption?: string;
  className?: string;
  keyed?: boolean;
  logos?: string[];
  onReady?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cargo = keyed || logos !== undefined;
  const fetched = useTopAddonLogos(keyed && logos === undefined);
  const effective = logos ?? fetched;
  const logosRef = useRef<string[]>([]);
  const cycleRef = useRef(0);
  const [dark] = useState(darkBackground);

  useEffect(() => {
    logosRef.current = effective;
  }, [effective]);

  const paint = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const imgs = root.querySelectorAll<SVGImageElement>("image");
    const list = logosRef.current;
    const count = imgs.length;
    imgs.forEach((img, k) => {
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      img.setAttribute("referrerpolicy", "no-referrer");
      const flyPos = count - 1 - k;
      const url = flyPos < list.length ? list[(cycleRef.current + flyPos) % list.length] : "";
      if (url) {
        img.setAttributeNS(XLINK, "href", url);
        img.setAttribute("href", url);
        img.style.opacity = "1";
      } else {
        img.style.opacity = "0";
      }
    });
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.replaceChildren();
    const anim: AnimationItem = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: cargo ? (dark ? whiteBoat : darkBoat) : harborBoat,
    });
    const onLoaded = () => {
      cycleRef.current = 0;
      paint();
      onReady?.();
    };
    const onLoop = () => {
      cycleRef.current += 3;
      paint();
    };
    anim.addEventListener("DOMLoaded", onLoaded);
    anim.addEventListener("loopComplete", onLoop);
    return () => {
      anim.removeEventListener("DOMLoaded", onLoaded);
      anim.removeEventListener("loopComplete", onLoop);
      anim.destroy();
      container.replaceChildren();
    };
  }, [dark, paint, cargo, onReady]);

  useEffect(() => {
    paint();
  }, [effective, paint]);

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div ref={ref} className={SIZE_CLASS[size]} aria-hidden />
      {caption && (
        <p className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.18em] text-white/70">
          {caption}
        </p>
      )}
    </div>
  );
}
