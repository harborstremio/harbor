import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";

const INPUT_SELECTOR = [
  'input[type="text"]',
  'input[type="email"]',
  'input[type="password"]',
  'input[type="search"]',
  'input:not([type])',
  "textarea",
].join(", ");

type KeyboardRow = { label: string; value: string; wide?: boolean }[];

const ROWS: KeyboardRow[] = [
  [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: "0", value: "0" },
  ],
  [
    { label: "Q", value: "Q" },
    { label: "W", value: "W" },
    { label: "E", value: "E" },
    { label: "R", value: "R" },
    { label: "T", value: "T" },
    { label: "Y", value: "Y" },
    { label: "U", value: "U" },
    { label: "I", value: "I" },
    { label: "O", value: "O" },
    { label: "P", value: "P" },
  ],
  [
    { label: "A", value: "A" },
    { label: "S", value: "S" },
    { label: "D", value: "D" },
    { label: "F", value: "F" },
    { label: "G", value: "G" },
    { label: "H", value: "H" },
    { label: "J", value: "J" },
    { label: "K", value: "K" },
    { label: "L", value: "L" },
  ],
  [
    { label: "Z", value: "Z" },
    { label: "X", value: "X" },
    { label: "C", value: "C" },
    { label: "V", value: "V" },
    { label: "B", value: "B" },
    { label: "N", value: "N" },
    { label: "M", value: "M" },
    { label: "\u232B", value: "backspace" },
  ],
  [
    { label: "SPACE", value: " ", wide: true },
    { label: "@", value: "@" },
    { label: ".com", value: ".com" },
    { label: "Done", value: "done", wide: true },
  ],
];

interface VirtualKeyboardProps {
  onInput: (value: string) => void;
  onClose: () => void;
  initialValue?: string;
}

export function VirtualKeyboard({ onInput, onClose, initialValue = "" }: VirtualKeyboardProps) {
  const [text, setText] = useState(initialValue);
  const [shift, setShift] = useState(false);
  const [focusIndex, setFocusIndex] = useState<{ row: number; col: number }>({
    row: 2,
    col: 4,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  const flatIndex = useCallback(
    (row: number, col: number) => {
      let idx = 0;
      for (let r = 0; r < row && r < ROWS.length; r++) {
        idx += ROWS[r].length;
      }
      return idx + col;
    },
    [],
  );

  const notifyInput = useCallback(
    (newText: string) => {
      setText(newText);
      onInputRef.current(newText);
    },
    [],
  );

  const handleKey = useCallback(
    (key: { label: string; value: string }) => {
      if (key.value === "done") {
        onClose();
        return;
      }
      if (key.value === "backspace") {
        notifyInput(text.slice(0, -1));
        return;
      }
      const char = shift ? key.value.toUpperCase() : key.value.toLowerCase();
      notifyInput(text + char);
      setShift(false);
    },
    [text, shift, onClose, notifyInput],
  );

  const clampCol = useCallback(
    (row: number, col: number) => {
      const max = ROWS[row]?.length ?? 0;
      if (max === 0) return 0;
      return ((col % max) + max) % max;
    },
    [],
  );

  const moveFocus = useCallback(
    (dx: number, dy: number) => {
      setFocusIndex((prev) => {
        const newRow = ((prev.row + dy + ROWS.length) % ROWS.length + ROWS.length) % ROWS.length;
        let newCol = prev.col + dx;
        if (dy !== 0) {
          newCol = clampCol(newRow, prev.col);
        } else {
          newCol = clampCol(newRow, newCol);
        }
        return { row: newRow, col: newCol };
      });
    },
    [clampCol],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focused = container.querySelector("[data-keyboard-key]:focus") as HTMLElement | null;
    if (!focused) {
      const allKeys = container.querySelectorAll<HTMLElement>("[data-keyboard-key]");
      const idx = flatIndex(focusIndex.row, focusIndex.col);
      if (idx < allKeys.length) {
        allKeys[idx]?.focus({ preventScroll: true });
      }
    }
  }, [focusIndex, flatIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "Up":
        case "w":
        case "W":
          e.preventDefault();
          e.stopPropagation();
          moveFocus(0, -1);
          break;
        case "ArrowDown":
        case "Down":
        case "s":
        case "S":
          e.preventDefault();
          e.stopPropagation();
          moveFocus(0, 1);
          break;
        case "ArrowLeft":
        case "Left":
        case "a":
        case "A":
          e.preventDefault();
          e.stopPropagation();
          moveFocus(-1, 0);
          break;
        case "ArrowRight":
        case "Right":
        case "d":
        case "D":
          e.preventDefault();
          e.stopPropagation();
          moveFocus(1, 0);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          e.stopPropagation();
          {
            const active = document.activeElement as HTMLElement | null;
            if (active?.dataset.keyboardKey) {
              const val = active.dataset.keyboardValue;
              if (val) handleKey({ label: active.textContent ?? "", value: val });
            }
          }
          break;
        case "Escape":
        case "Esc":
        case "BrowserBack":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
        case "Backspace":
          e.preventDefault();
          e.stopPropagation();
          notifyInput(text.slice(0, -1));
          break;
        case "Shift":
        case "CapsLock":
          e.preventDefault();
          setShift((s) => !s);
          break;
      }
    };

    container.addEventListener("keydown", onKeyDown, true);
    return () => container.removeEventListener("keydown", onKeyDown, true);
  }, [moveFocus, handleKey, onClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const allKeys = container.querySelectorAll<HTMLElement>("[data-keyboard-key]");
    const idx = flatIndex(focusIndex.row, focusIndex.col);
    if (idx < allKeys.length) {
      allKeys[idx]?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.preventDefault();
        }}
        tabIndex={-1}
        aria-hidden
      />
      <div
        ref={containerRef}
        className="relative mb-6 rounded-2xl p-5 pb-6"
        style={{ background: "#1a1a1a" }}
        role="group"
        aria-label="Virtual keyboard"
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex-1 rounded-lg px-4 py-2.5 text-base text-white"
            style={{ background: "#2a2a2a", minWidth: 320 }}
          >
            {text || <span className="text-white/30">Type here...</span>}
          </div>
          <button
            type="button"
            data-keyboard-key
            data-keyboard-value="done"
            onClick={onClose}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            style={{ background: "#3a7bd5" }}
          >
            Done
          </button>
        </div>
        {ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="mb-1.5 flex justify-center gap-1.5 last:mb-0">
            {row.map((key, colIdx) => {
              const isFocused =
                focusIndex.row === rowIdx && focusIndex.col === colIdx;
              const isSpecial = key.value === "backspace" || key.value === "done" || key.value === " " || key.value === ".com";
              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  type="button"
                  data-keyboard-key={rowIdx}
                  data-keyboard-value={key.value}
                  onClick={() => handleKey(key)}
                  onFocus={() => setFocusIndex({ row: rowIdx, col: colIdx })}
                  className={`rounded-lg text-center text-sm font-medium text-white transition-all
                    ${key.wide ? "flex-[2]" : "w-9 flex-1"}
                    ${isSpecial ? "px-2" : ""}
                    ${isFocused ? "ring-2" : ""}
                  `}
                  style={{
                    background: isSpecial ? "#3a7bd5" : "#2a2a2a",
                    paddingTop: 10,
                    paddingBottom: 10,
                    ...(isFocused ? {
                      ringColor: "#ffffff",
                      boxShadow: "0 0 0 2px #ffffff, 0 0 0 4px #3a7bd5",
                    } : {}),
                  }}
                >
                  {shift && key.value.length === 1 ? key.value.toUpperCase() : key.label}
                </button>
              );
            })}
          </div>
        ))}
        <p className="mt-3 text-center text-xs text-white/30">
          D-pad to navigate &middot; Enter/Space to type &middot; Back to close
        </p>
      </div>
    </div>
  );
}

export function useVirtualKeyboard(): {
  open: boolean;
  activeInput: HTMLInputElement | HTMLTextAreaElement | null;
  handleInput: (value: string) => void;
  handleClose: () => void;
} {
  const { settings } = useSettings();
  const [activeInput, setActiveInput] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const activeInputRef = useRef(activeInput);
  activeInputRef.current = activeInput;

  useEffect(() => {
    if (!settings.tvNavigation) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.matches(INPUT_SELECTOR)) return;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        setActiveInput(target);
        setKeyboardOpen(true);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.matches(INPUT_SELECTOR)) return;
      if (target === activeInputRef.current) {
        setKeyboardOpen(false);
        setActiveInput(null);
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [settings.tvNavigation]);

  const handleInput = useCallback(
    (value: string) => {
      const el = activeInputRef.current;
      if (!el) return;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value);
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [],
  );

  const handleClose = useCallback(() => {
    setKeyboardOpen(false);
    setActiveInput(null);
  }, []);

  return { open: keyboardOpen, activeInput, handleInput, handleClose };
}
