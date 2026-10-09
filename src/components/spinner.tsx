export function Spinner({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`harbor-spinner ${className}`}
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size * 0.13)),
      }}
    />
  );
}
