import { useState } from "react";
import { ArrowBigUp, Delete, Space, X } from "lucide-react";
import { isAndroid } from "@/lib/platform";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";

// [data-bp-row] is given the page gutter as padding plus a matching negative
// margin, which would push every key row outside the panel that hosts it.
const FLUSH = { paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 72px" } as const;


/**
 * The shared BpKeyboard is lowercase only and its symbol page carries no A-Z
 * and no underscore, which makes a Stremio password and a Harbor username
 * physically untypeable. Credentials need a shift layer, so onboarding ships
 * one rather than deferring the whole fallback.
 */
const LOWER = [
  "1234567890".split(""),
  "qwertyuiop".split(""),
  "asdfghjkl.".split(""),
  "zxcvbnm@-_".split(""),
];

const UPPER = [
  "1234567890".split(""),
  "QWERTYUIOP".split(""),
  "ASDFGHJKL.".split(""),
  "ZXCVBNM@-_".split(""),
];

const SYMBOLS = [
  "!#$%^&*()+".split(""),
  "=/\\|~`°£€:".split(""),
  ";\"?<>[]{},".split(""),
  "éèáàöüñçåø".split(""),
];

type Layer = "lower" | "upper" | "symbols";

function Key({
  label,
  onPress,
  wide,
  aria,
  on,
  children,
}: {
  label: string;
  onPress: () => void;
  wide?: number;
  aria?: string;
  on?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-key
      aria-label={aria ?? label}
      aria-pressed={on}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className={`flex h-[clamp(46px,5.4vh,66px)] min-w-[46px] flex-1 items-center justify-center rounded-[var(--bp-r-sm)] border text-[clamp(14px,2.1vh,26px)] font-semibold transition-[transform,background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] ${
        on
          ? "border-transparent bg-[var(--bp-on)] text-ink"
          : "border-[var(--bp-edge)] bg-[var(--bp-panel-2)] text-ink"
      }`}
      style={wide ? { flexGrow: wide } : undefined}
    >
      {children ?? label}
    </button>
  );
}

export function BpOnboardKeyboard({
  onChar,
  onBackspace,
  onClear,
}: {
  onChar: (c: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const [layer, setLayer] = useState<Layer>("lower");
  // Above the guard, never below it. isAndroid() is constant for the process so
  // the hook count was stable by accident, and the first hook added over this
  // return, or any gate that becomes dynamic, turns it into a hard crash on the
  // two screens the user is mid-typing on.
  const t = useBpT();

  if (isAndroid()) return null;
  const rows = layer === "symbols" ? SYMBOLS : layer === "upper" ? UPPER : LOWER;
  const shifted = layer === "upper";

  return (
    <div dir="ltr" className="flex flex-col gap-[clamp(5px,0.7vh,9px)]">
      {rows.map((row, i) => (
        <div key={i} data-bp-row style={FLUSH}>
          <div data-bp-scroll-x className="flex gap-[clamp(5px,0.45vw,9px)]">
            {row.map((c) => (
              <Key key={c} label={c} onPress={() => onChar(c)} />
            ))}
          </div>
        </div>
      ))}
      <div data-bp-row style={FLUSH}>
        <div data-bp-scroll-x className="flex gap-[clamp(5px,0.45vw,9px)]">
          <Key
            label="Shift"
            aria={t("Shift")}
            on={shifted}
            wide={2}
            onPress={() => setLayer(shifted ? "lower" : "upper")}
          >
            <ArrowBigUp size={21} strokeWidth={2.1} />
          </Key>
          <Key
            label={layer === "symbols" ? "abc" : "?#+"}
            aria={layer === "symbols" ? t("Letters") : t("Symbols")}
            wide={2}
            onPress={() => setLayer(layer === "symbols" ? "lower" : "symbols")}
          />
          <Key label="Space" aria={t("Space")} wide={5} onPress={() => onChar(" ")}>
            <Space size={20} strokeWidth={2.1} />
          </Key>
          <Key label="Backspace" aria={t("Backspace")} wide={2} onPress={onBackspace}>
            <Delete size={20} strokeWidth={2.1} />
          </Key>
          <Key label="Clear" aria={t("Clear")} wide={2} onPress={onClear}>
            <X size={20} strokeWidth={2.2} />
          </Key>
        </div>
      </div>
    </div>
  );
}
