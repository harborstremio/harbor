import { useEffect, useMemo, useState } from "react";

export function Avatar({
  name,
  src,
  color,
  size = 20,
}: {
  name: string;
  src?: string | null;
  color?: string | null;
  size?: number;
}) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const hue = useMemo(() => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }, [name]);
  if (src && !failed) {
    return (
      <span
        className="inline-flex shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size, boxShadow: color ? `0 0 0 1.5px ${color}` : undefined }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full font-semibold text-canvas"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.5)),
        backgroundColor: color ?? `oklch(0.78 0.13 ${hue})`,
      }}
    >
      {initial}
    </span>
  );
}
