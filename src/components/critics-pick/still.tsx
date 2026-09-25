import type { Meta } from "@/lib/cinemeta";
import { useTitleContext } from "@/components/context-menu/use-title-context";

export function Still({
  meta,
  src,
  alt,
  onClick,
}: {
  meta: Meta;
  src: string | undefined;
  alt: string;
  onClick?: () => void;
}) {
  const onContextMenu = useTitleContext(meta, src);
  if (!src) return <div className="aspect-[16/9] rounded-md bg-elevated/45" />;
  if (!onClick) {
    return (
      <div
        onContextMenu={onContextMenu}
        className="relative aspect-[16/9] overflow-hidden rounded-md border border-edge-soft"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-label={`Expand ${alt} image`}
      className="group/still relative aspect-[16/9] overflow-hidden rounded-md border border-edge-soft transition-colors duration-200 hover:border-ink"
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/still:scale-[1.04]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-canvas/0 transition-colors duration-200 group-hover/still:bg-canvas/20"
      />
    </button>
  );
}
