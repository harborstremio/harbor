export function SharedListBackdrop({ banner }: { banner?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[65vh] overflow-hidden">
      {banner ? (
        <img
          src={banner}
          alt=""
          draggable={false}
          className="h-full w-full scale-110 object-cover opacity-[0.45] blur-3xl saturate-[1.2]"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{ background: "linear-gradient(160deg, var(--color-elevated), var(--color-surface) 50%, var(--color-canvas))" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/25 via-canvas/40 to-canvas" />
    </div>
  );
}
