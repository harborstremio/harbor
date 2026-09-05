import { fillStyle } from "@/components/slider";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Move, ZoomIn } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getDirection, isRtl } from "@/lib/keyboard-navigation/geometry";
import { ROW_ACTION } from "@/views/settings/kit";
import { ROW_DESC, ROW_TITLE } from "@/views/settings/shared";

const OUT_W = 1600;
const OUT_H = 900;

const HINT_CHIP =
  "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

export function CoverCropper({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const t = useT();
  const frameRef = useRef<HTMLDivElement>(null);
  const imgEl = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const nudgeTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(nudgeTimer.current), []);
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const frameSize = () => {
    const r = frameRef.current?.getBoundingClientRect();
    return { w: r?.width || 0, h: r?.height || 0 };
  };

  const clamp = useCallback(
    (o: { x: number; y: number }, z: number, n: { w: number; h: number }) => {
      const f = frameSize();
      if (!n.w || !f.w) return { x: 0, y: 0 };
      const scale = Math.max(f.w / n.w, f.h / n.h) * z;
      const maxX = Math.max(0, (n.w * scale - f.w) / 2);
      const maxY = Math.max(0, (n.h * scale - f.h) / 2);
      return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
    },
    [],
  );

  const commit = useCallback(
    (o: { x: number; y: number }, z: number, n: { w: number; h: number }) => {
      window.clearTimeout(nudgeTimer.current);
      const im = imgEl.current;
      const f = frameSize();
      if (!im || !n.w || !f.w) return onChange(null);
      const scale = Math.max(f.w / n.w, f.h / n.h) * z;
      const sw = f.w / scale;
      const sh = f.h / scale;
      const sx = n.w / 2 - (o.x + f.w / 2) / scale;
      const sy = n.h / 2 - (o.y + f.h / 2) / scale;
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return onChange(null);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
      canvas.toBlob((b) => onChange(b), "image/webp", 0.9);
    },
    [onChange],
  );

  const pick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        imgEl.current = im;
        const n = { w: im.naturalWidth, h: im.naturalHeight };
        setNat(n);
        setSrc(url);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        commit({ x: 0, y: 0 }, 1, n);
      };
      im.src = url;
    };
    input.click();
  };

  const onDown = (e: React.PointerEvent) => {
    if (!src) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset(
      clamp(
        {
          x: drag.current.ox + (e.clientX - drag.current.x),
          y: drag.current.oy + (e.clientY - drag.current.y),
        },
        zoom,
        nat,
      ),
    );
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    commit(offset, zoom, nat);
  };

  const onFrameKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = src ? getDirection(e.nativeEvent) : null;
    if (!dir) return;
    const step = 24;
    const forward = (dir === "right") !== isRtl(e.currentTarget);
    const next = clamp(
      {
        x: dir === "left" || dir === "right" ? offset.x + (forward ? step : -step) : offset.x,
        y: dir === "up" ? offset.y - step : dir === "down" ? offset.y + step : offset.y,
      },
      zoom,
      nat,
    );
    if (next.x === offset.x && next.y === offset.y) return;
    e.preventDefault();
    setOffset(next);
    window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => commit(next, zoom, nat), 220);
  };

  const dispScale = nat.w
    ? Math.max((frameSize().w || 1) / nat.w, (frameSize().h || 1) / nat.h) * zoom
    : 1;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onFrameKeyDown}
        tabIndex={src ? 0 : undefined}
        role={src ? "group" : undefined}
        aria-label={src ? t("drag to position") : undefined}
        className={`relative aspect-video w-full select-none overflow-hidden rounded-md bg-elevated ${src ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {src ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  flex: "0 0 auto",
                  width: nat.w * dispScale,
                  height: nat.h * dispScale,
                  maxWidth: "none",
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-0 transition-opacity duration-200 [.cursor-grab:active_&]:opacity-100">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/15" />
              ))}
            </div>
            <div
              className={`${HINT_CHIP} pointer-events-none absolute bottom-2 start-2 bg-black/55 text-white backdrop-blur-sm`}
            >
              <Move size={14} /> {t("drag to position")}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={pick}
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-ink-subtle transition-colors hover:text-ink"
          >
            <ImagePlus size={28} strokeWidth={1.6} />
            <span className={ROW_TITLE}>{t("Add a cover image")}</span>
            <span className={`${ROW_DESC} max-w-[66ch]`}>
              {t("A 16:9 shot of your theme looks best")}
            </span>
          </button>
        )}
      </div>
      {src && (
        <div className="flex items-center gap-3">
          <ZoomIn size={16} className="shrink-0 text-ink-subtle" />
          <input
            type="range"
            aria-label={t("Zoom")}
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const z = Number(e.target.value);
              const o = clamp(offset, z, nat);
              setZoom(z);
              setOffset(o);
              commit(o, z, nat);
            }}
            className="harbor-slider h-11 min-w-0 flex-1"
            style={fillStyle(zoom, 1, 3, 0.01)}
          />
          <button type="button" onClick={pick} className={ROW_ACTION}>
            {t("Replace")}
          </button>
        </div>
      )}
    </div>
  );
}
