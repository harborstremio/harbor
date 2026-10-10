import { useState, type ReactNode } from "react";

export function DockButton({
  label,
  active,
  scale,
  baseSize,
  onClick,
  hideIndicator,
  children,
}: {
  label: string;
  active: boolean;
  scale: number;
  baseSize: number;
  onClick: () => void;
  hideIndicator?: boolean;
  children: ReactNode;
}) {
  const [punch, setPunch] = useState(false);
  const handleClick = () => {
    setPunch(true);
    onClick();
    window.setTimeout(() => setPunch(false), 220);
  };
  const lift = scale > 1 ? (scale - 1) * 14 : 0;
  return (
    <div
      className="relative flex shrink-0 flex-col items-center justify-end"
      style={{
        width: baseSize * scale,
        height: baseSize,
        zIndex: Math.round(scale * 100),
        transition: "width 140ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className="harbor-minui-button flex items-center justify-center rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{
          width: baseSize,
          height: baseSize,
          background: active ? "var(--color-accent)" : "var(--color-elevated)",
          color: active ? "#fff" : "var(--color-ink-muted)",
          borderColor: active ? "transparent" : "var(--color-edge-soft)",
          boxShadow: active
            ? "0 10px 24px -10px var(--color-accent-soft), inset 0 1px 0 rgba(255,255,255,0.22)"
            : "0 2px 6px -2px rgba(15,15,18,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
          transform: `translateY(${-lift}px) scale(${punch ? 0.9 : scale})`,
          transformOrigin: "center bottom",
          transition: punch
            ? "transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 160ms ease, color 160ms ease, box-shadow 160ms ease"
            : "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms ease, color 200ms ease, box-shadow 200ms ease",
        }}
      >
        {children}
      </button>
      {hideIndicator ? null : (
        <span
          aria-hidden
          className="absolute bottom-[-10px] h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--color-accent)",
            opacity: active ? 1 : 0,
            transform: `scale(${active ? 1 : 0.4})`,
            transition: "opacity 160ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      )}
    </div>
  );
}
