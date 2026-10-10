import { useEffect, useId, useRef, useState } from "react";
import { SFX } from "@/lib/sfx";
import { BpExitPreview } from "./bp-exit-preview";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

const BTN = "clamp(56px, 6.6vh, 78px)";

function motionReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BpExitConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(
    () =>
      pushBpBack(() => {
        onCancel();
        return true;
      }),
    [onCancel],
  );

  const t = useBpT();
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [reduce] = useState(motionReduced);

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
    // A flat scrim, deliberately. backdrop-filter over the full screen ambient
    // recomposites the whole page every frame, which is what made this open
    // visibly late on the exact hardware Big Picture is for.
    <div
      className="absolute inset-0 z-[70] grid place-items-center px-[var(--bp-gutter)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
      style={{ background: "color-mix(in oklab, var(--bp-void) 88%, transparent)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* animation stays inline: a class loses to the [dir=rtl] [role=dialog]
          rule in bp-tokens, which slides this in sideways. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-bp-dialog
        className="relative flex w-[clamp(340px,30vw,560px)] max-w-full flex-col items-center gap-[clamp(14px,1.8vh,28px)] p-[clamp(24px,2.8vh,46px)] text-center"
        style={{
          borderRadius: "var(--bp-r-lg)",
          border: "1px solid var(--bp-edge-2)",
          background: "var(--bp-panel-2)",
          boxShadow: "0 40px 120px -30px rgba(0, 0, 0, 0.9)",
          animation: reduce ? undefined : "bp-rise var(--bp-dur) var(--bp-ease) 60ms backwards",
        }}
      >
        <BpExitPreview className="w-[clamp(96px,12vh,168px)]" />

        <div className="flex flex-col items-center gap-[clamp(5px,0.7vh,11px)]">
          <h2
            id={titleId}
            className="font-display text-ink"
            style={{
              fontSize: "clamp(30px, 3.9vh, 40px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
            }}
          >
            {t("Back to the window?")}
          </h2>

          <p
            id={bodyId}
            className="text-ink-muted"
            style={{
              maxWidth: "32ch",
              fontSize: "clamp(17px, 2.3vh, 24px)",
              lineHeight: 1.45,
            }}
          >
            {t("Big Picture closes. Harbor keeps running behind it.")}
          </p>
        </div>

        {/* No data-bp-restore-key here. With one, Back-then-Back would reopen
            this dialog pre-selected on Leave. It must always open on Not now. */}
        <div className="flex items-center gap-[clamp(10px,1.2vh,20px)]">
          {/* Resting fill and border must stay classes. The chip focus rule in
              bp-tokens sets background without !important, so an inline fill
              here outranks it and the D-pad cursor never lights this button. */}
          <button
            ref={cancelRef}
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            onClick={() => {
              SFX.click();
              onCancel();
            }}
            className="border border-[var(--bp-edge-2)] font-semibold text-ink"
            style={{
              height: BTN,
              paddingInline: "clamp(22px, 2.2vh, 40px)",
              borderRadius: "var(--bp-r-md)",
              fontSize: "clamp(17px, 2.2vh, 24px)",
            }}
          >
            {t("Not now")}
          </button>

          {/* Bordered, and text-ink. With no edge and muted text this read at ten
              feet as a caption rather than as the other half of a two-button
              choice, so a viewer could miss that there was a second option at
              all. The difference between these two is which one the ring is on. */}
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.close();
              onConfirm();
            }}
            className="border border-[var(--bp-edge-2)] font-semibold text-ink"
            style={{
              height: BTN,
              paddingInline: "clamp(22px, 2.2vh, 40px)",
              borderRadius: "var(--bp-r-md)",
              fontSize: "clamp(17px, 2.2vh, 24px)",
            }}
          >
            {t("Leave Big Picture")}
          </button>
        </div>
      </div>
    </div>
  );
}
