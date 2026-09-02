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
  const [failed, setFailed] = useState(false);
  const blank = !src || failed;
  const [ready, setReady] = useState(false);
  return (
    <img
      src={blank ? BLANK : src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      data-ready={!blank && ready ? "1" : undefined}
      data-blank={blank ? "1" : undefined}
      onLoad={() => setReady(true)}
      onError={() => setFailed(true)}
      style={style}
      className={`harbor-preview-img ${className}`}
    />
  );
}
