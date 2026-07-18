export function Still({
  src,
  alt,
  onClick,
}: {
  src: string | undefined;
  alt: string;
  onClick?: () => void;
}) {
  if (!src) return <div className="aspect-[16/9] rounded-md bg-elevated/45" />;
  if (!onClick) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-edge-soft">
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
