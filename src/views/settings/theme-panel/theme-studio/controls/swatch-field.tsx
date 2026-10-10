import { useState, type ReactNode } from "react";
import { ColorPopover } from "./color-popover";

export function SwatchField({
  label,
  value,
  onChange,
  className = "",
  children,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  children?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <ColorPopover label={label} value={value} onChange={onChange} className={`overflow-hidden ${className}`}>
      {(open) => (
        <span
          className="block h-full min-h-11 w-full"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <span aria-hidden className="absolute inset-0" style={{ background: value }} />
          <span
            aria-hidden
            className={`absolute inset-0 ring-inset transition-shadow ${open ? "ring-2 ring-accent" : "ring-1 ring-edge-soft"}`}
          />
          {children}
          <span
            aria-hidden
            className={`pointer-events-none absolute end-1.5 top-1.5 rounded-md bg-canvas/85 px-1.5 py-0.5 text-[15.5px] font-medium leading-[22px] tabular-nums text-ink ring-1 ring-edge-soft transition-opacity ${
              hover || open ? "opacity-100" : "opacity-0"
            }`}
          >
            {value.toUpperCase()}
          </span>
        </span>
      )}
    </ColorPopover>
  );
}
