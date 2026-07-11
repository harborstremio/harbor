import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

function isFsrcnnxActive(shaders: unknown): boolean {
  if (!shaders) return false;
  const s = String(shaders);
  return s.toLowerCase().includes("fsrcnnx");
}

export function FsrcnnxIndicator() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const shaders = await invoke("mpv_get_property", {
        name: "glsl-shaders",
      }).catch(() => null);
      if (!cancelled) setActive(isFsrcnnxActive(shaders));
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none select-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{
        background: "rgba(0,0,0,0.55)",
        color: "#e0b84e",
        border: "1px solid rgba(224,184,78,0.45)",
        backdropFilter: "blur(4px)",
      }}
      title="FSRCNNX x2 upscaling active"
    >
      FSRCNNX
    </div>
  );
}
