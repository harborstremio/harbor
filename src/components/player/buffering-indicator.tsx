import { useEffect, useState } from "react";

export function BufferingIndicator({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 450);
    return () => window.clearTimeout(timer);
  }, [show]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_8px_24px_-10px_rgba(0,0,0,0.7)]">
        <svg
          className="h-9 w-9 text-white motion-safe:animate-spin motion-reduce:animate-none"
          viewBox="0 0 40 40"
          fill="none"
        >
          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset="72"
          />
        </svg>
      </div>
    </div>
  );
}
