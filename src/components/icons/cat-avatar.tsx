import { useEffect, useState } from "react";

/* ponytail: lazy-load the 2.1MB default avatar to keep it out of the main bundle */
let _cached: string | null = null;

export function CatAvatar({ className }: { className?: string }) {
  const [src, setSrc] = useState<string>(_cached ?? "");
  useEffect(() => {
    if (_cached) { setSrc(_cached); return; }
    import("@/assets/stremio-default-avatar.png").then((m) => {
      _cached = m.default;
      setSrc(m.default);
    });
  }, []);
  if (!src) return <div className={`${className ?? ""} bg-surface`} />;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`${className ?? ""} object-cover`}
    />
  );
}
