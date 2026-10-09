import type { ReactNode } from "react";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { useSettings } from "@/lib/settings";

export function WindowControlGlyph({ kind, maximized = false }: {
  kind: "minimize" | "maximize" | "close";
  maximized?: boolean;
}) {
  return (
    <svg width="18" height="18" viewBox="0 0 13 13" fill="none" aria-hidden>
      {kind === "minimize" ? (
        <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : kind === "close" ? (
        <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : maximized ? (
        <>
          <rect x="2.5" y="4.5" width="6" height="6" stroke="currentColor" strokeWidth="1.4" rx="1" />
          <path d="M5 4.5V3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </>
      ) : (
        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.4" rx="1.2" />
      )}
    </svg>
  );
}

export function WindowControlButton({
  label,
  onClick,
  danger = false,
  children,
  appearance,
}: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  children: ReactNode;
  appearance?: "transparent" | "glass" | "filled";
}) {
  const { settings } = useSettings();
  const glassControls = (appearance ?? settings.topbarAppearance) === "glass";
  const button = (
    <button
      type="button"
      data-tauri-drag-region="false"
      aria-label={label}
      onClick={onClick}
      className={`harbor-win-control ${danger ? "harbor-win-close" : ""} flex h-full w-full items-center justify-center rounded-[inherit] bg-transparent text-ink-muted outline-none transition-colors duration-150 ${
        danger ? "hover:bg-[#e5484d] hover:text-white" : "hover:bg-white/[0.06] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );

  if (glassControls) {
    return (
      <ThreeLiquidGlassSurface
        radius="12px"
        shaderRadius={0.48}
        intensity={0.9}
        className="h-11 w-12 shrink-0 border border-white/[0.10]"
        contentClassName="h-full w-full"
      >
        {button}
      </ThreeLiquidGlassSurface>
    );
  }

  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      aria-label={label}
      onClick={onClick}
      className={`harbor-win-control ${danger ? "harbor-win-close" : ""} flex h-11 w-12 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted transition-colors duration-150 ${
        danger ? "hover:bg-[#e5484d] hover:text-white" : "hover:bg-elevated hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
