import { Tooltip } from "./tooltip";

export function PipIconBtn({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  const btn = (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
        disabled
          ? "cursor-not-allowed text-white/25"
          : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
    </button>
  );
  if (disabled) return btn;
  return <Tooltip label={label}>{btn}</Tooltip>;
}

export function PipStepBtn({
  label,
  onClick,
  icon,
  stepText,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  stepText: string;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="inline-flex h-11 w-10 flex-col items-center justify-center gap-0 rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        {icon}
        <span className="text-[8.5px] font-semibold uppercase leading-none tracking-[0.06em] text-white/70">
          {stepText}
        </span>
      </button>
    </Tooltip>
  );
}
