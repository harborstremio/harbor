import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, Minus, Plus, RotateCcw, X } from "lucide-react";
import {
  canCopyContextImage,
  copyContextImage,
  loadContextImage,
  saveContextImage,
  type ContextImage,
} from "@/lib/context-image";
import { pushBackHandler } from "@/lib/back-intercept";
import { useContextTarget } from "@/lib/context-menu";
import { t } from "@/lib/i18n";

const KEYBOARD_PAN_PIXELS = 40;

export function ContextImageViewer({
  image,
  onClose,
  returnFocus,
}: {
  image: ContextImage;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState("");
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const imageElement = useRef<HTMLImageElement | null>(null);
  const currentScale = useRef(scale);
  currentScale.current = scale;
  const imageTarget = useContextTarget<HTMLImageElement>(() => ({
    kind: "content",
    image: { ...image, src: url ?? image.src, originalSrc: image.originalSrc ?? image.src },
    label: image.label,
  }));
  const zoom = (amount: number) => setScale((value) => Math.max(1, Math.min(8, value * amount)));
  const reset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const controller = new AbortController();
    let ownedUrl: string | null = null;
    setUrl(null);
    setError("");
    setScale(1);
    setPan({ x: 0, y: 0 });
    void loadContextImage(image, { signal: controller.signal })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        ownedUrl = URL.createObjectURL(loaded.blob);
        setUrl(ownedUrl);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? t(failure.message) : t("Could not load image."));
      });
    return () => {
      controller.abort();
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [image.src, image.originalSrc]);

  useEffect(() => {
    const previous =
      returnFocus === undefined
        ? document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
        : returnFocus;
    dialog.current?.focus({ preventScroll: true });
    const removeBack = pushBackHandler(() => {
      close.current();
      return true;
    });
    const onKey = (event: KeyboardEvent) => {
      const active = event.target instanceof Element ? event.target : document.activeElement;
      if (active?.closest("[data-harbor-context-layer]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        event.stopImmediatePropagation();
        zoom(1.25);
      } else if (event.key === "-") {
        event.preventDefault();
        event.stopImmediatePropagation();
        zoom(0.8);
      } else if (event.key === "0") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setScale(1);
        setPan({ x: 0, y: 0 });
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const limitX = ((imageElement.current?.offsetWidth ?? 0) * (currentScale.current - 1)) / 2;
        const limitY = ((imageElement.current?.offsetHeight ?? 0) * (currentScale.current - 1)) / 2;
        setPan((point) => ({
          x: Math.max(
            -limitX,
            Math.min(
              limitX,
              point.x +
                (event.key === "ArrowLeft"
                  ? KEYBOARD_PAN_PIXELS
                  : event.key === "ArrowRight"
                    ? -KEYBOARD_PAN_PIXELS
                    : 0),
            ),
          ),
          y: Math.max(
            -limitY,
            Math.min(
              limitY,
              point.y +
                (event.key === "ArrowUp"
                  ? KEYBOARD_PAN_PIXELS
                  : event.key === "ArrowDown"
                    ? -KEYBOARD_PAN_PIXELS
                    : 0),
            ),
          ),
        }));
      } else if (event.key === "Tab") {
        const buttons = [
          ...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        if (!buttons.length) return;
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        event.stopImmediatePropagation();
        const next =
          at < 0
            ? event.shiftKey
              ? buttons.length - 1
              : 0
            : (at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      removeBack();
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const target = viewport.current;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    target?.addEventListener("wheel", onWheel, { passive: false });
    return () => target?.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (scale === 1) setPan({ x: 0, y: 0 });
  }, [scale]);

  const buttonClass =
    "flex h-10 w-10 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-lg hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40";
  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      data-bp-overlay
      data-harbor-image-viewer
      aria-modal="true"
      aria-label={image.label || t("Image viewer")}
      tabIndex={-1}
      className="fixed inset-0 z-[500] flex flex-col bg-black/85 text-ink backdrop-blur-2xl outline-none"
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div className="absolute inset-x-6 top-8 z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            className={buttonClass}
            aria-label={t("Zoom out")}
            disabled={!url || scale <= 1}
            onClick={() => zoom(0.8)}
          >
            <Minus size={18} />
          </button>
          <span className="min-w-12 text-center text-sm tabular-nums" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button
            className={buttonClass}
            aria-label={t("Zoom in")}
            disabled={!url || scale >= 8}
            onClick={() => zoom(1.25)}
          >
            <Plus size={18} />
          </button>
          <button
            className={buttonClass}
            aria-label={t("Reset zoom")}
            disabled={!url}
            onClick={reset}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className={buttonClass}
            aria-label={t("Copy image")}
            title={t("Copy image")}
            disabled={!url || copying || !canCopyContextImage()}
            onClick={() => {
              setCopying(true);
              setNotice("");
              void copyContextImage(image)
                .then(() => setNotice(t("Image copied")))
                .catch((failure: unknown) =>
                  setNotice(
                    failure instanceof Error ? t(failure.message) : t("Could not copy image."),
                  ),
                )
                .finally(() => setCopying(false));
            }}
          >
            <Copy size={18} />
          </button>
          <button
            className={buttonClass}
            aria-label={t("Save image")}
            title={t("Save image")}
            disabled={!url || saving}
            onClick={() => {
              setSaving(true);
              setNotice("");
              void saveContextImage(image)
                .then((result) => {
                  if (result.saved)
                    setNotice(result.path ? t("Image saved") : t("Download started"));
                })
                .catch((failure: unknown) =>
                  setNotice(
                    failure instanceof Error ? t(failure.message) : t("Could not save image."),
                  ),
                )
                .finally(() => setSaving(false));
            }}
          >
            <Download size={18} />
          </button>
        </div>
        <button className={buttonClass} aria-label={t("Close")} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div
        ref={viewport}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-16 py-24"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {error ? (
          <p role="alert" className="max-w-md rounded-2xl bg-canvas p-6 text-center">
            {error}
          </p>
        ) : !url ? (
          <p role="status">{t("Loading image…")}</p>
        ) : (
          <img
            ref={(node) => {
              imageElement.current = node;
              imageTarget(node);
            }}
            src={url}
            alt={image.label || ""}
            draggable={false}
            className="max-h-full max-w-full touch-none select-none rounded-xl object-contain shadow-2xl"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              cursor: scale > 1 ? "grab" : "zoom-in",
            }}
            onError={() => setError(t("This image could not be decoded."))}
            onDoubleClick={reset}
            onPointerDown={(event) => {
              if (event.button !== 0 || scale <= 1) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (!start) return;
              const limitX = (event.currentTarget.offsetWidth * (scale - 1)) / 2;
              const limitY = (event.currentTarget.offsetHeight * (scale - 1)) / 2;
              setPan({
                x: Math.max(-limitX, Math.min(limitX, start.panX + event.clientX - start.x)),
                y: Math.max(-limitY, Math.min(limitY, start.panY + event.clientY - start.y)),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
        )}
      </div>
      {notice && (
        <p role="status" className="absolute bottom-6 inset-x-6 text-center text-sm">
          {notice}
        </p>
      )}
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
