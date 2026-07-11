export function CardArtBackdrop({ logo }: { logo: string | null | undefined; background?: string | null }) {
  if (!logo) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${logo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.1,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--color-canvas) 0%, var(--color-canvas) 42%, color-mix(in oklch, var(--color-canvas) 78%, transparent) 68%, color-mix(in oklch, var(--color-canvas) 42%, transparent) 100%)",
        }}
      />
    </div>
  );
}
