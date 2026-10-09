import { useState } from "react";

/** The designed art underneath stays visible until a working photo is decoded. */
export function BackdropPhoto({ sources, hero }: { sources: string[]; hero: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState("");
  const src = sources.find((url) => !failed.includes(url));
  if (!src) return null;
  return (
    <img
      key={src}
      src={src}
      alt=""
      draggable={false}
      loading={hero ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={hero ? "high" : "auto"}
      onLoad={() => setLoaded(src)}
      onError={() => setFailed((previous) => [...previous, src])}
      style={{ visibility: loaded === src ? "visible" : "hidden" }}
      className={`animate-fade-in absolute inset-0 h-full w-full object-cover ${
        hero ? "jl-kenburns opacity-90" : "opacity-75"
      }`}
    />
  );
}
