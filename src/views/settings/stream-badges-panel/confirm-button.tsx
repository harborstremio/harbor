import { useState } from "react";

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      onClick={() => {
        if (!armed) {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 3000);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={`h-10 shrink-0 rounded-md px-4 text-[13px] font-medium transition-colors ${
        armed ? "bg-danger/15 text-danger" : "text-ink-subtle hover:bg-raised hover:text-ink"
      } ${className ?? ""}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
