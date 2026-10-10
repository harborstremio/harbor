export function StremioBtn({
  children,
  onClick,
  ariaLabel,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`pointer-events-auto flex h-16 w-16 items-center justify-center rounded-xl transition-colors duration-150 ${
        disabled
          ? "cursor-not-allowed text-white/30"
          : active
            ? "bg-white/[0.08] text-white"
            : "text-white/90 hover:bg-white/[0.05]"
      }`}
    >
      {children}
    </button>
  );
}
