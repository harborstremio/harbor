import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { StoreBundle } from "@/lib/bundle-store";
import { labelForIcon } from "./bundle-labels";

function PackTile({
  url,
  label,
  variant,
}: {
  url: string;
  label: string;
  variant: "hero" | "detail";
}) {
  const [failed, setFailed] = useState(false);
  if (variant === "hero") {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 rounded-md bg-elevated px-2.5 py-2 ring-1 ring-edge-soft">
        <span className="grid h-6 w-6 shrink-0 place-items-center">
          {!failed && (
            <img
              src={url}
              alt=""
              draggable={false}
              onError={() => setFailed(true)}
              className="h-full w-full object-contain"
            />
          )}
        </span>
        <span className="text-[15.5px] font-normal leading-[22px] text-ink-muted">{label}</span>
      </span>
    );
  }
  return (
    <span className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-md bg-elevated px-2.5 py-2 ring-1 ring-edge-soft">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-surface">
        {!failed && (
          <img
            src={url}
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
            className="h-5 w-5 object-contain"
          />
        )}
      </span>
      <span className="truncate text-[15.5px] font-normal leading-[22px] text-ink">{label}</span>
    </span>
  );
}

export function PackContents({
  bundle,
  variant,
  className,
}: {
  bundle: StoreBundle;
  variant: "hero" | "detail";
  className?: string;
}) {
  const t = useT();
  const icons = bundle.icons;
  if (icons.length === 0) return null;
  const shown = variant === "hero" ? icons.slice(0, 5) : icons;
  const overflow = icons.length - shown.length;
  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      <span className="harbor-settings-label">
        {t("{count} in this pack", { count: icons.length })}
      </span>
      <div
        className={
          variant === "hero" ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3"
        }
      >
        {shown.map((ic) => (
          <PackTile
            key={ic.key}
            url={ic.url}
            label={labelForIcon(bundle.kind, ic.key)}
            variant={variant}
          />
        ))}
        {variant === "hero" && overflow > 0 && (
          <span className="inline-flex min-h-11 items-center rounded-md bg-elevated px-3 py-2 text-[15.5px] font-normal leading-[22px] text-ink-muted ring-1 ring-edge-soft">
            {t("+{count} more", { count: overflow })}
          </span>
        )}
      </div>
    </div>
  );
}
