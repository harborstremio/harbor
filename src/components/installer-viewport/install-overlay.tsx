import lottie, { type AnimationItem } from "lottie-web";
import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import installBoat from "@/assets/lottie/install-boat-white.json";

export type OverlayPhase =
  | { kind: "installing"; name: string | null }
  | { kind: "success"; name: string; logo: string | null };

const XLINK = "http://www.w3.org/1999/xlink";

function InstallBoat({ logo }: { logo: string | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<string | null>(logo);

  useEffect(() => {
    logoRef.current = logo;
  }, [logo]);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const anim: AnimationItem = lottie.loadAnimation({
      container: host,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: installBoat,
    });

    const keyLogo = () => {
      const url = logoRef.current;
      host.querySelectorAll<SVGImageElement>("image").forEach((img) => {
        img.setAttribute("preserveAspectRatio", "xMidYMid meet");
        img.setAttribute("referrerpolicy", "no-referrer");
        if (url) {
          img.setAttributeNS(XLINK, "href", url);
          img.setAttribute("href", url);
          img.style.opacity = "1";
        } else {
          img.style.opacity = "0";
        }
      });
    };

    anim.addEventListener("DOMLoaded", keyLogo);
    anim.addEventListener("loopComplete", keyLogo);
    return () => {
      anim.removeEventListener("DOMLoaded", keyLogo);
      anim.removeEventListener("loopComplete", keyLogo);
      anim.destroy();
    };
  }, []);

  return <div ref={ref} className="h-60 w-60" aria-hidden />;
}

export function InstallOverlay({ phase, logo }: { phase: OverlayPhase; logo: string | null }) {
  const installing = phase.kind === "installing";
  const name = phase.kind === "success" ? phase.name : (phase.name ?? "Resolving manifest");
  const cargoLogo = logo ?? (phase.kind === "success" ? phase.logo : null);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/92 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300">
        <InstallBoat logo={cargoLogo} />
        <div className="flex flex-col items-center gap-1.5">
          {installing ? (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.26em] text-accent">
              Installing
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.26em] text-emerald-400">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={11} strokeWidth={3} />
              </span>
              Added to Harbor
            </span>
          )}
          <span className="font-display text-[24px] leading-none tracking-tight text-ink">
            {name}
          </span>
          {!installing && (
            <span className="text-[12.5px] text-ink-muted">Saved to your library.</span>
          )}
        </div>
      </div>
    </div>
  );
}
