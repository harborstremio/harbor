import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";

export function KawaiiBunny() {
  const { settings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = String(settings.theme.preset) === "kawaii";

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let instance: { cleanup?: () => void; resizeDrawingSurfaceToCanvas?: () => void } | null = null;

    void import("@rive-app/canvas")
      .then(async ({ Rive, Layout, Fit, Alignment, RuntimeLoader }) => {
        if (disposed) return;
        const wasm = (await import("@rive-app/canvas/rive.wasm?url")).default;
        RuntimeLoader.setWasmUrl(wasm);
        instance = new Rive({
          src: "/bunny-hop.riv",
          canvas,
          autoplay: true,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
          onLoad: () => instance?.resizeDrawingSurfaceToCanvas?.(),
        }) as unknown as { cleanup?: () => void; resizeDrawingSurfaceToCanvas?: () => void };
      })
      .catch(() => {});

    return () => {
      disposed = true;
      instance?.cleanup?.();
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      width={232}
      height={232}
      className="pointer-events-none absolute bottom-0 end-[26px] h-[116px] w-[116px]"
    />
  );
}
