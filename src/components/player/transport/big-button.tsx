import { Tooltip } from "./tooltip";

export function BigButton({
  children,
  onClick,
  ariaLabel,
  tooltip,
  active,
  disabled,
  iconUrl,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  tooltip?: string;
  active?: boolean;
  disabled?: boolean;
  iconUrl?: string;
}) {
  const btn = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-[background-color,color,opacity,transform] duration-150 active:scale-90 motion-reduce:active:scale-100 ${
        disabled
          ? "cursor-not-allowed text-white/30"
          : active
            ? "bg-white/22 text-white hover:bg-white/30"
            : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          width={22}
          height={22}
          draggable={false}
          className="pointer-events-none h-[22px] w-[22px] select-none object-contain"
        />
      ) : (
        children
      )}
    </button>
  );
  if (!tooltip) return btn;
  return <Tooltip label={tooltip}>{btn}</Tooltip>;
}
