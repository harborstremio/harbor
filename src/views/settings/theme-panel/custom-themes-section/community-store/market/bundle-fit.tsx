import { useState } from "react";
import { Package } from "lucide-react";
import type { StoreBundle } from "@/lib/bundle-store";

function IconTile({ url, className }: { url: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`grid shrink-0 place-items-center rounded-[8px] bg-surface ring-1 ring-edge-soft ${className}`}>
      {!failed && (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-3/5 w-3/5 object-contain"
        />
      )}
    </span>
  );
}

export function BundleFitBody({
  icons,
  cover,
  size = "card",
}: {
  icons: StoreBundle["icons"];
  cover?: string | null;
  size?: "card" | "hero";
}) {
  const max = size === "hero" ? 10 : 8;
  const shown = icons.slice(0, max);
  const overflow = icons.length - shown.length;
  const tile = size === "hero" ? "h-14 w-14" : "h-11 w-11";
  return (
    <div className="relative h-full w-full overflow-hidden bg-elevated">
      {cover && (
        <img
          src={cover}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}
      {shown.length > 0 ? (
        <div className="relative flex h-full w-full flex-wrap content-center items-center justify-center gap-2 p-4">
          {shown.map((ic) => (
            <IconTile key={ic.key} url={ic.url} className={tile} />
          ))}
          {overflow > 0 && (
            <span
              className={`grid shrink-0 place-items-center rounded-[8px] bg-surface text-[15.5px] font-semibold leading-[22px] tabular-nums text-ink-muted ring-1 ring-edge-soft ${tile}`}
            >
              +{overflow}
            </span>
          )}
        </div>
      ) : (
        <div className="grid h-full w-full place-items-center text-ink-subtle">
          <Package size={size === "hero" ? 40 : 28} />
        </div>
      )}
    </div>
  );
}

export function BundleFit({ bundle, size = "card" }: { bundle: StoreBundle; size?: "card" | "hero" }) {
  return <BundleFitBody icons={bundle.icons} cover={bundle.cover} size={size} />;
}
