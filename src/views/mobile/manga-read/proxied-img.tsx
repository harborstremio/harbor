import { useRef, useState, type CSSProperties } from "react";
import { proxied } from "./local-reader-types";

export function ProxiedImg({
  url,
  className,
  style,
}: {
  url: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [src, setSrc] = useState(url);
  const [loaded, setLoaded] = useState(false);
  const triedProxy = useRef(false);
  const prev = useRef(url);

  if (prev.current !== url) {
    prev.current = url;
    setSrc(url);
    setLoaded(false);
    triedProxy.current = false;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (triedProxy.current) return;
        triedProxy.current = true;
        setSrc(proxied(url));
      }}
      className={`${className ?? ""} transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
      style={style}
    />
  );
}
