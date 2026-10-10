import { useEffect, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { SFX } from "@/lib/sfx";
import { bpTileArtWidth } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { registerBpTarget } from "./bp-focus-meta";
import { useBpArt } from "./use-bp-art";

export function BpResultCard({
  meta,
  onSelect,
  autofocus,
}: {
  meta: Meta;
  onSelect: (m: Meta) => void;
  autofocus?: boolean;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    registerBpTarget(ref.current, { meta });
  }, [meta.id]);

  const art = useBpArt({
    ref,
    id: meta.id,
    type: meta.type,
    shape: "wide",
    poster: meta.poster,
    background: meta.background,
    targetWidth: bpTileArtWidth("wide"),
  });
  const src = useProxiedImageSrc(art.url);

  return (
    <button
      ref={ref}
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={meta.id}
      data-bp-autofocus={autofocus ? "true" : undefined}
      onClick={() => {
        SFX.click();
        onSelect(meta);
      }}
      className="group relative flex aspect-[16/9] w-full flex-col justify-end overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-transform duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
    >
      <BpArt
        src={src}
        onError={art.onError}
        className={`transition-transform duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] group-hover:scale-[1.04] ${
          art.wide ? "object-cover" : "object-cover object-top blur-[1px] saturate-[1.1]"
        }`}
      />

      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-up)" }} />
      <div className="relative grid p-[clamp(10px,0.85vw,18px)] [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:self-end">
        {meta.logo && (
          <img
            src={meta.logo}
            alt={meta.name}
            data-bp-result-logo
            className="max-h-[clamp(26px,3.4vh,48px)] w-auto max-w-[76%] justify-self-start object-contain object-left drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)] transition-[opacity,transform] duration-[var(--bp-dur)] ease-[var(--bp-ease)] group-hover:-translate-y-1 group-hover:opacity-0 group-data-[bp-focus=true]:-translate-y-1 group-data-[bp-focus=true]:opacity-0 motion-reduce:transition-none"
          />
        )}
        <span
          data-bp-result-title
          className={`line-clamp-2 font-display text-[clamp(13px,1.85vh,22px)] font-semibold leading-[1.15] tracking-[-0.015em] text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] ${
            meta.logo
              ? "translate-y-1 opacity-0 transition-[opacity,transform] duration-[var(--bp-dur)] ease-[var(--bp-ease)] group-hover:translate-y-0 group-hover:opacity-100 group-data-[bp-focus=true]:translate-y-0 group-data-[bp-focus=true]:opacity-100 motion-reduce:transition-none"
              : ""
          }`}
        >
          {meta.name}
        </span>
      </div>
    </button>
  );
}
