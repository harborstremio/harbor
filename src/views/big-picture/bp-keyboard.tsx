import { useState } from "react";
import { Delete, Space, X } from "lucide-react";
import { isAndroid } from "@/lib/platform";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";

const LETTERS = [
  "1234567890".split(""),
  "qwertyuiop".split(""),
  "asdfghjkl'".split(""),
  "zxcvbnm,.-".split(""),
];

// [data-bp-row] is given the page gutter as padding plus a matching negative
// margin, which would push every key row outside the panel that hosts it.
const FLUSH = { paddingInline: 0, marginInline: 0 } as const;


const SYMBOLS = [
  "!@#$%^&*()".split(""),
  "+=/\\|~`°£€".split(""),
  ":;\"?<>[]{}".split(""),
  "éèáàöüñçåø".split(""),
];

function Key({
  label,
  onPress,
  wide,
  aria,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  wide?: number;
  aria?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
      data-bp-key
      aria-label={aria ?? label}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className="flex h-[clamp(44px,5.4vh,64px)] min-w-[44px] flex-1 items-center justify-center rounded-[var(--bp-r-sm)] border border-[var(--bp-edge)] bg-[var(--bp-panel-2)] text-[clamp(14px,2.15vh,25px)] font-semibold text-ink transition-[transform,background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
      style={wide ? { flexGrow: wide } : undefined}
    >
      {children ?? label}
    </button>
  );
}

export function BpKeyboard({
  onChar,
  onBackspace,
  onClear,
  disabled,
}: {
  onChar: (c: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [symbols, setSymbols] = useState(false);
  const t = useBpT();
  const rows = symbols ? SYMBOLS : LETTERS;

  if (isAndroid()) return null;

  return (
    <div dir="ltr" className="flex flex-col gap-[clamp(5px,0.7vh,9px)]">
      {rows.map((row, i) => (
        <div key={i} data-bp-row style={FLUSH}>
          <div data-bp-scroll-x className="flex gap-[clamp(5px,0.45vw,9px)]">
            {row.map((c) => (
              <Key key={c} label={c} onPress={() => onChar(c)} disabled={disabled} />
            ))}
          </div>
        </div>
      ))}
      <div data-bp-row style={FLUSH}>
      <div data-bp-scroll-x className="flex gap-[clamp(5px,0.45vw,9px)]">
        <Key
          label={symbols ? "abc" : "?#+"}
          aria={symbols ? t("Letters") : t("Symbols")}
          onPress={() => setSymbols((s) => !s)}
          wide={2}
          disabled={disabled}
        />
        <Key label="Space" aria={t("Space")} onPress={() => onChar(" ")} wide={5} disabled={disabled}>
          <Space size={19} strokeWidth={2.1} />
        </Key>
        <Key label="Backspace" aria={t("Backspace")} onPress={onBackspace} wide={2} disabled={disabled}>
          <Delete size={19} strokeWidth={2.1} />
        </Key>
        <Key label="Clear" aria={t("Clear search")} onPress={onClear} wide={2} disabled={disabled}>
          <X size={19} strokeWidth={2.2} />
        </Key>
      </div>
      </div>
    </div>
  );
}
