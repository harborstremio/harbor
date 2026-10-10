import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from "react";
import { Box, RotateCcw, RotateCw } from "lucide-react";
import type { SkinViewer } from "skinview3d";
import { useT } from "@/lib/i18n";
import type { SkinModel } from "@/lib/games/minecraft-skin";

export function MinecraftSkinViewer({ pixels, model, active, cape }: { pixels: Uint8ClampedArray; model: SkinModel; active: boolean; cape?: string }) {
  const t = useT(), host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), viewer = useRef<SkinViewer | null>(null);
  const [ready, setReady] = useState(0), [failed, setFailed] = useState(false), [rotate, setRotate] = useState(false), [animate, setAnimate] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const query = matchMedia("(prefers-reduced-motion: reduce)"); const change = () => setReduced(query.matches); query.addEventListener("change", change); return () => query.removeEventListener("change", change); }, []);
  useEffect(() => {
    if (!active || !canvas.current || !host.current) return;
    let disposed = false; let observer: ResizeObserver | undefined;
    setFailed(false);
    void import("skinview3d").then(({ SkinViewer }) => {
      if (disposed || !canvas.current || !host.current) return;
      const instance = new SkinViewer({ canvas: canvas.current, width: host.current.clientWidth, height: host.current.clientHeight, renderPaused: true });
      viewer.current = instance; instance.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      instance.fov = 40; instance.zoom = .85; instance.playerObject.rotation.y = -.35;
      instance.controls.enablePan = false; instance.controls.minDistance = 35; instance.controls.maxDistance = 100;
      instance.globalLight.intensity = 2; instance.cameraLight.intensity = .6;
      instance.controls.addEventListener("change", () => instance.render());
      observer = new ResizeObserver(() => { if (host.current) { instance.setSize(host.current.clientWidth, host.current.clientHeight); instance.render(); } }); observer.observe(host.current);
      setReady(n => n + 1);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; observer?.disconnect(); viewer.current?.dispose(); viewer.current = null; };
  }, [active]);
  useEffect(() => {
    const instance = viewer.current; if (!instance) return;
    try {
      const source = document.createElement("canvas"); source.width = 64; source.height = 64;
      const context = source.getContext("2d"); if (!context) throw new Error("skin_canvas");
      const image = context.createImageData(64, 64); image.data.set(pixels); context.putImageData(image, 0, 0);
      instance.loadSkin(source, { model: model === "classic" ? "default" : "slim" });
      instance.render();
    } catch { setFailed(true); }
  }, [pixels, model, ready]);
  useEffect(() => {
    const instance = viewer.current; if (!instance) return;
    let cancelled = false;
    instance.loadCape(null); instance.render();
    if (cape) {
      const image = new Image(); image.src = cape;
      void image.decode().then(() => {
        if (cancelled || viewer.current !== instance) return;
        instance.loadCape(image); instance.render();
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [cape, ready]);
  useEffect(() => {
    const visibility = () => { if (viewer.current) viewer.current.renderPaused = document.hidden || reduced || (!rotate && !animate); };
    document.addEventListener("visibilitychange", visibility); visibility();
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [ready, rotate, animate, reduced]);
  useEffect(() => { const instance = viewer.current; if (instance) instance.autoRotate = active && rotate && !reduced; }, [active, rotate, reduced, ready]);
  useEffect(() => {
    const instance = viewer.current; if (!instance) return;
    let disposed = false;
    if (!animate || reduced) { instance.animation = null; instance.render(); }
    else void import("skinview3d").then(({ WalkingAnimation }) => { if (!disposed && viewer.current === instance) { instance.animation = new WalkingAnimation(); instance.animation.speed = .65; } });
    return () => { disposed = true; };
  }, [animate, reduced, ready]);
  return <div className="mc-skin-preview">
    <div className="mc-skin-stage" ref={host}>
      <div className="mc-skin-plinth" aria-hidden="true" />
      <canvas ref={canvas} tabIndex={0} aria-label={t("games.minecraft.preview")} onContextMenu={e => e.preventDefault()} onKeyDown={e => {
        const v = viewer.current; if (!v || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") v.playerObject.rotation.y += e.key === "ArrowLeft" ? -.2 : .2;
        else if (e.key === "Home") { v.controls.reset(); v.zoom = .85; v.playerObject.rotation.y = -.35; }
        else v.zoom = Math.max(.5, Math.min(1.8, v.zoom + (e.key === "ArrowUp" ? .1 : -.1)));
        v.render();
      }} />
      {failed && <div className="mc-skin-webgl" role="status"><Box size={32} /><p>{t("games.minecraft.webgl")}</p></div>}
    </div>
    <div className="mc-skin-camera" role="group" aria-label={t("games.minecraft.preview")}>
      <button type="button" title={t("games.minecraft.rotate")} aria-label={t("games.minecraft.rotate")} aria-pressed={rotate} disabled={failed || reduced} onClick={() => setRotate(v => !v)}><RotateCw size={18} /></button>
      <button type="button" title={t("games.minecraft.animate")} aria-label={t("games.minecraft.animate")} aria-pressed={animate} disabled={failed || reduced} onClick={() => setAnimate(v => !v)}><Play size={18} /></button>
      <button type="button" title={t("games.minecraft.resetView")} aria-label={t("games.minecraft.resetView")} disabled={failed} onClick={() => { const v = viewer.current; if (v) { v.controls.reset(); v.zoom = .85; v.playerObject.rotation.y = -.35; v.render(); } }}><RotateCcw size={18} /></button>
    </div>
    <p className="mc-skin-preview-hint">{t("games.minecraft.previewHint")}</p>
  </div>;
}
