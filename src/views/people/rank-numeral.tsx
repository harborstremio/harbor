type NumeralSize = "hero" | "featured" | "dense";

const STROKE: Record<NumeralSize, string> = {
  hero: "2px",
  featured: "2px",
  dense: "1.5px",
};

function fontSize(size: NumeralSize, digits: number): string {
  if (size === "hero") return "clamp(120px, 20vw, 240px)";
  if (size === "featured") {
    if (digits <= 1) return "clamp(56px, 7cqi, 92px)";
    if (digits === 2) return "clamp(44px, 5.5cqi, 72px)";
    return "clamp(34px, 4.4cqi, 56px)";
  }
  if (digits <= 1) return "clamp(44px, 5.6cqi, 74px)";
  if (digits === 2) return "clamp(36px, 4.4cqi, 58px)";
  return "clamp(28px, 3.6cqi, 46px)";
}

export function RankNumeral({
  rank,
  size,
  tie = false,
}: {
  rank: number;
  size: NumeralSize;
  tie?: boolean;
}) {
  const digits = String(rank).length;
  return (
    <span
      aria-hidden
      className="pointer-events-none block select-none leading-none tabular-nums text-transparent"
      style={{
        fontFamily: "var(--font-rank)",
        fontWeight: 600,
        fontSize: fontSize(size, digits),
        letterSpacing: "-0.01em",
        WebkitTextStroke: `${STROKE[size]} var(--color-ink-muted)`,
        WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 12%, #000 60%, transparent 88%)",
        maskImage: "linear-gradient(to right, transparent 0, #000 12%, #000 60%, transparent 88%)",
      }}
    >
      {tie ? "=" : ""}
      {rank}
    </span>
  );
}
