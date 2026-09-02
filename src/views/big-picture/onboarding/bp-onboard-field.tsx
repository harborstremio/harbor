import { useRef, useState } from "react";
import { isAndroid } from "@/lib/platform";
import { BP_ROW_FLUSH } from "./bp-step-parts";
import { Eye, EyeOff } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";

const FIELD_SCOPE = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 96px" } as const;

/**
 * The ten-foot text field. It carries data-tv-text-auto so focus alone arms the
 * phone keyboard, and it never persists on keystroke, only the screen above it
 * decides when a draft becomes a saved value.
 *
 * Trap: submitFocusedText() blurs and fires dispatchTvNav("down"), so whatever
 * sits directly below a field is where a phone "Done" lands.
 */
export function BpOnboardField({
  label,
  value,
  placeholder,
  secret,
  revealed,
  onReveal,
  onFocus,
  onChange,
  onSubmit,
  active,
}: {
  label: string;
  value: string;
  placeholder: string;
  secret?: boolean;
  revealed?: boolean;
  onReveal?: () => void;
  onFocus?: () => void;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  active?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [armed, setArmed] = useState(false);
  // The ring lands here the moment the step opens, and on Android focusing a
  // writable input throws the system IME over the whole screen before the user
  // has asked for anything. Held readOnly until OK, so the keyboard is a choice.
  const locked = isAndroid() && !armed;

  const t = useBpT();
  const masked = !!secret && !revealed;
  return (
    <div data-bp-row style={FIELD_SCOPE}>
      <div data-bp-scroll-x className="flex items-end gap-[clamp(9px,0.9vw,16px)]">
        <label className="flex min-w-0 flex-1 flex-col gap-[clamp(4px,0.6vh,9px)]">
          <span className="text-[clamp(11px,1.45vh,17px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            {label}
          </span>
          <span
            className={`flex h-[clamp(54px,6.4vh,80px)] items-center rounded-[var(--bp-r-md)] border bg-[var(--bp-panel)] px-[clamp(16px,1.4vw,28px)] ${
              active ? "border-[var(--bp-focus-stroke)]" : "border-[var(--bp-edge-2)]"
            }`}
          >
            <input
              data-bp-focusable
              data-tv-text-auto
              ref={inputRef}
              readOnly={locked}
              inputMode={locked ? "none" : undefined}
              type={masked ? "password" : "text"}
              value={value}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              onFocus={onFocus}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.stopPropagation();
                if (locked) {
                  setArmed(true);
                  requestAnimationFrame(() => inputRef.current?.focus());
                  return;
                }
                if (!onSubmit) return;
                e.preventDefault();
                onSubmit();
              }}
              onBlur={() => setArmed(false)}
              placeholder={placeholder}
              aria-label={label}
              className="min-w-0 flex-1 bg-transparent text-[clamp(16px,2.3vh,30px)] font-semibold tracking-[0.01em] text-ink outline-none placeholder:text-ink-subtle"
            />
          </span>
        </label>
        {secret && onReveal && (
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.click();
              onReveal();
            }}
            aria-label={revealed ? t("Hide") : t("Show")}
            className="flex h-[clamp(54px,6.4vh,80px)] w-[clamp(54px,6.4vh,80px)] shrink-0 items-center justify-center rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] text-ink"
          >
            {revealed ? <EyeOff size={22} strokeWidth={2.1} /> : <Eye size={22} strokeWidth={2.1} />}
          </button>
        )}
      </div>
    </div>
  );
}
