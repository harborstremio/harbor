import { useEffect, useState } from "react";

type Layer = { id: number; src: string };

let seq = 0;

export function useHeroLayers(src?: string): Layer[] {
  const [layers, setLayers] = useState<Layer[]>(() => (src ? [{ id: ++seq, src }] : []));
  useEffect(() => {
    if (!src) {
      setLayers([]);
      return;
    }
    setLayers((prev) =>
      prev[prev.length - 1]?.src === src ? prev : [...prev.slice(-1), { id: ++seq, src }],
    );
  }, [src]);
  return layers;
}
