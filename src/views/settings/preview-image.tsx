import { useState, type CSSProperties } from "react";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function PreviewImage({
  src,
  className = "",
  style,
}: {
  src: string | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const blank = !src || failedSrc === src;
  const [readySrc, setReadySrc] = useState<string>();
  return (
    <img
      src={blank ? BLANK : src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      data-ready={!blank && readySrc === src ? "1" : undefined}
      data-blank={blank ? "1" : undefined}
      onLoad={() => setReadySrc(src)}
      onError={() => setFailedSrc(src)}
      style={style}
      className={`harbor-preview-img ${className}`}
    />
  );
}
