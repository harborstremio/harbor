export function Pill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-full bg-canvas/85 px-3 py-1 transition-all hover:scale-[1.04] hover:bg-canvas"
      >
        {children}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-canvas/85 px-3 py-1">
      {children}
    </span>
  );
}
