export function NytMark({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] border border-current text-ink"
      style={{
        height: size,
        paddingInline: size * 0.28,
        fontFamily: '"Times New Roman", Times, Georgia, serif',
        fontSize: size * 0.62,
        fontWeight: 700,
        letterSpacing: size * 0.04,
        lineHeight: 1,
      }}
    >
      NYT
    </span>
  );
}

export function NytBestsellerTag({
  rank,
  weeks,
  compact,
}: {
  rank: number;
  weeks?: number;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <NytMark size={compact ? 15 : 18} />
      <span
        className={`font-semibold tracking-tight ${compact ? "text-[12px]" : "text-[13px]"}`}
      >
        {`#${rank} Bestseller`}
      </span>
      {weeks != null && weeks > 0 && (
        <span className={`text-ink-subtle ${compact ? "text-[11px]" : "text-[12px]"}`}>
          {weeks === 1 ? "1 week" : `${weeks} weeks`}
        </span>
      )}
    </span>
  );
}
