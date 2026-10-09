import { useEffect, useRef } from "react";
import { SFX } from "@/lib/sfx";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";
import { pushBpBack } from "./bp-back";

const BTN =
  "h-[clamp(56px,6.6vh,72px)] flex-1 rounded-[var(--bp-r-xs)] border text-[clamp(17px,2.2vh,22px)] font-bold";

export function BpConfirm({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  width = "520px",
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  width?: string;
}) {
  useEffect(
    () =>
      pushBpBack(() => {
        onCancel();
        return true;
      }),
    [onCancel],
  );

  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // The root autofocus pass is keyed on the route and stops after its settle
  // window, so a dialog opened later seeds itself and hands focus back on close.
  useEffect(() => {
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    if (cancelRef.current) setBpFocus(cancelRef.current, { silent: true });
    return () => {
      if (prev?.isConnected) setBpFocus(prev, { silent: true });
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-label={title}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
    >
      <div
        className="flex flex-col gap-[clamp(18px,2.4vh,32px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]"
        style={{ width: `min(84vw, ${width})` }}
      >
        <div className="flex flex-col gap-[clamp(6px,0.9vh,13px)]">
          <h2 className="font-display text-[clamp(28px,3.6vh,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h2>
          <p className="text-[clamp(17px,2.2vh,22px)] leading-relaxed text-ink-subtle">{body}</p>
        </div>

        {/* Neither of these may rest as a fill. bp-tokens fills the FOCUSED chip
            with --bp-touch, so a filled resting pill beside it leaves two solid
            pills whose only difference is hue, and here that ambiguity sits on a
            destroy-or-keep decision. The safe path is the tinted one and the
            destructive one is plain: emphasis must never favour destroy. */}
        <div
          data-bp-row
          data-bp-scroll-x
          style={{ paddingInline: 0, marginInline: 0 }}
          className="flex gap-[clamp(9px,0.9vw,16px)]"
        >
          <button
            ref={cancelRef}
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            onClick={() => {
              SFX.close();
              onCancel();
            }}
            className={`${BTN} border-transparent bg-[var(--bp-on)] text-ink`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.click();
              onConfirm();
            }}
            className={`${BTN} border-[var(--bp-edge-2)] text-ink`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
