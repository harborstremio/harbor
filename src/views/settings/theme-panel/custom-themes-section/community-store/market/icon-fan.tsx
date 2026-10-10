import { useState, type ReactNode } from "react";

export type IconThumb = { src?: string; alt?: string };

function FanTile({ icon, first }: { icon: IconThumb; first: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-elevated ring-1 ring-edge-soft ${
        first ? "" : "-ms-2"
      }`}
    >
      {icon.src && !failed && (
        <img
          src={icon.src}
          alt={icon.alt ?? ""}
          draggable={false}
          onError={() => setFailed(true)}
          className="h-5 w-5 object-contain"
        />
      )}
    </span>
  );
}

export function IconFan({ icons, max = 5, fallback }: { icons: IconThumb[]; max?: number; fallback?: ReactNode }) {
  const shown = icons.slice(0, max);
  if (shown.length === 0) return fallback ? <>{fallback}</> : null;
  return (
    <span className="flex shrink-0 items-center ps-2">
      {shown.map((icon, i) => (
        <FanTile key={i} icon={icon} first={i === 0} />
      ))}
    </span>
  );
}
