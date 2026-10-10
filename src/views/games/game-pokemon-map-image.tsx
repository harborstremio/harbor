import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { safeFetchBytes } from "@/lib/safe-fetch";
import { APP_VERSION } from "@/lib/build-info";

/** Use the bounded native image transport; Archives can reject renderer hotlinks. */
export function PokemonMapImage({ src, alt = "" }: { src: string; alt?: string }) {
  const [image, setImage] = useState<{ source: string; blob: string }>();
  const root = useRef<HTMLSpanElement>(null), [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController(); let blob = "";
    const load = async () => {
      if (!/^https:\/\/archives\.bulbagarden\.net\/media\//.test(src)) return;
      const headers = new Headers({ Accept: "image/png,image/jpeg,image/gif,image/webp" });
      if ("__TAURI_INTERNALS__" in window) headers.set("User-Agent", `Harbor/${APP_VERSION} (+https://harbor.site)`);
      const response = await safeFetchBytes(src, { signal: controller.signal, headers, credentials: "omit" }, 15_000, 8_000_000);
      if (!response.ok) throw Error("Map image unavailable");
      const bytes = await response.arrayBuffer(); controller.signal.throwIfAborted();
      const type = response.headers.get("content-type")?.split(";")[0];
      if (!type || !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(type) || bytes.byteLength > 8_000_000) return;
      blob = URL.createObjectURL(new Blob([bytes], { type })); setImage({ source: src, blob });
    };
    void load().catch(() => {});
    return () => { controller.abort(); if (blob) URL.revokeObjectURL(blob); };
  }, [src, visible]);
  return <span ref={root} className="pokemon-map-image">{image?.source === src ? <img src={image.blob} alt={alt} decoding="async"/> : <MapPin size={24} aria-hidden="true"/>}</span>;
}
