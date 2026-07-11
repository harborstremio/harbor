import { useSettings } from "@/lib/settings";
import { useState } from "react";

function BlurUpBackdrop({ src, forceBlur }: { src: string; forceBlur: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const lowSrc = src.replace(/\/t\/p\/(w\d+|h\d+)\//, "/t/p/w300/");
  const hiSrc = src.replace(/\/t\/p\/(w\d+|h\d+)\//, "/t/p/original/");
  return (
    <>
      <img
        src={lowSrc}
        alt=""
        decoding="async"
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50 blur-2xl"
      />
      <img
        src={hiSrc}
        alt=""
        decoding="async"
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(true);
        }}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full scale-105 object-cover transition-opacity duration-700 ${
          forceBlur ? "blur-2xl" : ""
        } ${loaded ? "opacity-50" : "opacity-0"}`}
      />
    </>
  );
}

export function BackdropLayer({ src }: { src?: string }) {
  const { settings } = useSettings();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {src && <BlurUpBackdrop key={src} src={src} forceBlur={settings.streamBackdropBlur} />}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/30 via-canvas/85 to-canvas" />
      <div className="absolute inset-0 bg-gradient-to-r from-canvas/55 via-transparent to-canvas/55" />
    </div>
  );
}
