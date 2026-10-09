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
        disabled ? "cursor-not-allowed text-white/25" : "text-white/85 hover:bg-white/10 hover:text-white"
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
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="inline-flex h-11 w-10 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        {icon}
      </button>
    </Tooltip>
  );
}
