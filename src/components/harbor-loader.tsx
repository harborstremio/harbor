import { useEffect, useState } from "react";
import jlMark from "@/assets/brand/jl-mark.webp";
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

const LOGO_CYCLE_MS = 1800;

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
  const cargo = keyed || logos !== undefined;
  const fetched = useTopAddonLogos(keyed && logos === undefined);
  const effective = cargo ? (logos ?? fetched) : [];
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (effective.length <= 3) return;
    const id = window.setInterval(() => setCycle((c) => c + 3), LOGO_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [effective.length]);

  const shown = effective.length
    ? Array.from({ length: Math.min(3, effective.length) }, (_, k) => effective[(cycle + k) % effective.length])
    : [];

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className={`relative flex items-center justify-center ${SIZE_CLASS[size]}`} aria-hidden>
        <div className="jl-loader-glow absolute inset-[14%] rounded-full" />
        <div className="jl-loader-ring absolute inset-[4%] rounded-full" />
        <img
          src={jlMark}
          alt=""
          draggable={false}
          onLoad={() => onReady?.()}
          onError={() => onReady?.()}
          className="jl-loader-mark relative h-[58%] w-[58%] object-contain"
        />
      </div>
      {shown.length > 0 && (
        <div className="flex items-center gap-2" aria-hidden>
          {shown.map((url, k) => (
            <img
              key={`${cycle}-${k}`}
              src={url}
              alt=""
              referrerPolicy="no-referrer"
              draggable={false}
              className="h-6 w-6 rounded-md object-contain"
            />
          ))}
        </div>
      )}
      {caption && (
        <p className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.18em] text-white/70">
          {caption}
        </p>
      )}
    </div>
  );
}
