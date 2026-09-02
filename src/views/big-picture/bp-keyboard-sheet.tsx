import { useEffect, useRef } from "react";
import { CornerDownLeft } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "./bp-back";
import { BpKeyboard } from "./bp-keyboard";
import { useBpT } from "./bp-i18n";
import { bpFocusables, setBpFocus } from "./use-bp-focus";

// The scrim the keys sit on. Solid at the floor so the last row reads against the
// page, fading out at the top so the suggestions behind the sheet are still there
// rather than cut off by a hard panel edge.
const SHEET_WASH =
  "linear-gradient(to top, var(--bp-void) 0%, color-mix(in oklab, var(--bp-void) 94%, transparent) 62%, transparent 100%)";

// The keyboard is a bottom sheet, not a permanent strip. It slides up only once
// the field is activated and, while up, carries data-bp-dialog so bpFocusScope
// narrows every arrow to the keys: the ring cannot leave for the grid until Done
// or Back is pressed, which is the whole point of the rework. Closed, it is inert
// and translated off screen, so it costs the suggestions grid no height at all.
export function BpKeyboardSheet({
  open,
  onChar,
  onBackspace,
  onClear,
  onDone,
}: {
  open: boolean;
  onChar: (c: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const t = useBpT();
  const ref = useRef<HTMLDivElement | null>(null);

  // Land the ring on the first key when the sheet opens, and hand Back to onDone
  // so the remote's Back closes the sheet exactly like the Done key. Both are
  // registered together so a sheet that opens always has a way out.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const first = bpFocusables(ref.current)[0];
      if (first) setBpFocus(first, { silent: true });
    });
    const off = pushBpBack(() => {
      onDone();
      return true;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      off();
    };
  }, [open, onDone]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t("On-screen keyboard")}
      aria-hidden={!open}
      inert={!open}
      data-bp-dialog={open ? "" : undefined}
      className={`absolute inset-x-0 bottom-0 z-[60] px-[var(--bp-gutter)] pb-[clamp(52px,6.4vh,86px)] pt-[clamp(16px,2vh,28px)] transition-transform duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ background: SHEET_WASH }}
    >
      <div className="mx-auto flex w-full max-w-[min(94vw,1180px)] flex-col gap-[clamp(5px,0.7vh,9px)]">
        <BpKeyboard
          disabled={!open}
          onChar={onChar}
          onBackspace={onBackspace}
          onClear={onClear}
        />
        <div data-bp-row style={{ paddingInline: 0, marginInline: 0 }}>
          <button
            type="button"
            data-bp-focusable
            data-bp-key
            data-bp-disabled={open ? undefined : "true"}
            tabIndex={open ? undefined : -1}
            aria-label={t("Done")}
            onClick={() => {
              SFX.click();
              onDone();
            }}
            className="flex h-[clamp(44px,5.4vh,64px)] w-full items-center justify-center gap-[10px] rounded-[var(--bp-r-sm)] border border-[var(--bp-edge)] bg-[var(--bp-touch)] text-[clamp(14px,2.15vh,25px)] font-bold text-[var(--bp-void)] transition-[transform,background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
          >
            <CornerDownLeft size={19} strokeWidth={2.3} />
            {t("Done")}
          </button>
        </div>
      </div>
    </div>
  );
}
