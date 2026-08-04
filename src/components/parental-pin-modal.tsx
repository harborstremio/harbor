import { Delete, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

type Mode =
  | { kind: "unlock"; onUnlock: () => void; onCancel: () => void }
  | { kind: "set"; onSet: (pin: string) => Promise<void>; onCancel: () => void };

export function ParentalPinModal({
  mode,
  verify,
  kids = false,
}: {
  mode: Mode;
  verify?: (pin: string) => Promise<boolean>;
  kids?: boolean;
}) {
  const t = useT();
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const focus = () => inputRef.current?.focus();

  useEffect(() => {
    const t = setTimeout(focus, 30);
    return () => clearTimeout(t);
  }, [stage]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 360);
  };

  useEffect(() => {
    if (pin.length !== 4) return;
    let cancelled = false;
    (async () => {
      if (busy) return;
      if (mode.kind === "unlock") {
        setBusy(true);
        const ok = await verify!(pin);
        if (cancelled) return;
        setBusy(false);
        if (ok) {
          mode.onUnlock();
        } else {
          setError(t("Wrong PIN"));
          setPin("");
          triggerShake();
          focus();
        }
        return;
      }
      if (stage === "enter") {
        setFirst(pin);
        setPin("");
        setStage("confirm");
        setError(null);
        return;
      }
      if (pin !== first) {
        setError(t("PINs didn't match. Start over."));
        setFirst("");
        setPin("");
        setStage("enter");
        triggerShake();
        focus();
        return;
      }
      setBusy(true);
      await mode.onSet(pin);
      if (cancelled) return;
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        mode.onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode]);

  const headerLabel =
    mode.kind === "unlock"
      ? kids
        ? t("Grown-ups only")
        : t("Enter your PIN")
      : stage === "enter"
        ? t("Set a 4-digit PIN")
        : t("Confirm your PIN");
  const headerSub =
    mode.kind === "unlock"
      ? kids
        ? t("Ask a grown-up to enter the parent PIN.")
        : t("Parental controls are on. Enter your PIN to access settings.")
      : stage === "enter"
        ? t("You'll need this to access settings while controls are on.")
        : t("Type the same PIN one more time.");

  const tap = (digit: string) => {
    setError(null);
    setPin((p) => (p.length >= 4 ? p : p + digit));
    focus();
  };
  const backspace = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
    focus();
  };

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[280] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) mode.onCancel();
      }}
    >
      <div
        className={`relative flex w-full max-w-[420px] flex-col gap-7 overflow-hidden rounded-[24px] px-9 py-9 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200 ${
          kids ? "text-white" : "modal-panel border border-edge-soft bg-elevated/95"
        } ${shake ? "animate-[pin-shake_0.34s_ease]" : ""}`}
      >
        {kids && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#3aa6c4] via-[#1c789f] to-[#0c4a6e]" />
            <img
              src="/kids/doodles/lilbluewhale.png"
              alt=""
              draggable={false}
              className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-auto opacity-90"
              style={{ transform: "scaleX(-1)" }}
            />
            <img
              src="/kids/doodles/lilpurpocto.png"
              alt=""
              draggable={false}
              className="pointer-events-none absolute -bottom-2 left-3 h-16 w-auto opacity-80"
            />
            <img
              src="/kids/doodles/lilorangestar2.png"
              alt=""
              draggable={false}
              className="pointer-events-none absolute right-6 top-5 h-8 w-auto opacity-90"
            />
          </>
        )}
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2
              className={`text-[19px] font-medium tracking-tight ${kids ? "font-display text-[22px] font-bold text-white" : "text-ink"}`}
            >
              {headerLabel}
            </h2>
            <p
              className={`text-[12.5px] leading-relaxed ${kids ? "text-white/85" : "text-ink-muted"}`}
            >
              {headerSub}
            </p>
          </div>
          <button
            onClick={mode.onCancel}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              kids
                ? "bg-white/15 text-white/85 hover:bg-white/25 hover:text-white"
                : "bg-canvas/40 text-ink-subtle hover:bg-canvas/60 hover:text-ink"
            }`}
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={focus}
            aria-label={t("Focus PIN entry")}
            dir="ltr"
            className="relative flex cursor-text items-center gap-3 rounded-full px-3 py-2"
          >
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              autoComplete="one-time-code"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setError(null);
                setPin(v);
              }}
              className="absolute inset-0 cursor-text rounded-full bg-transparent text-transparent caret-transparent outline-none [-webkit-text-security:disc] selection:bg-transparent"
              aria-label={t("PIN")}
            />
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`pointer-events-none h-4 w-4 rounded-full ring-1 transition-all ${
                  pin.length > i
                    ? kids
                      ? "scale-110 bg-white ring-white"
                      : "scale-110 bg-ink ring-ink"
                    : kids
                      ? "bg-transparent ring-white/50"
                      : "bg-transparent ring-edge-soft"
                }`}
              />
            ))}
          </button>
          {error && (
            <p className={`text-[12.5px] font-medium ${kids ? "text-amber-200" : "text-red-300"}`}>
              {error}
            </p>
          )}
          <div dir="ltr" className="grid grid-cols-3 gap-2.5 pt-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <PinKey key={d} onClick={() => tap(d)} disabled={busy} kids={kids}>
                {d}
              </PinKey>
            ))}
            <span className="h-12 w-12" />
            <PinKey onClick={() => tap("0")} disabled={busy} kids={kids}>
              0
            </PinKey>
            <PinKey
              onClick={backspace}
              disabled={busy || pin.length === 0}
              kids={kids}
              aria-label={t("Delete")}
            >
              <Delete size={18} strokeWidth={1.8} />
            </PinKey>
          </div>
        </div>

        <p
          className={`relative text-center text-[11.5px] ${kids ? "text-white/70" : "text-ink-subtle"}`}
        >
          {t("Type on your keyboard or tap the digits above.")}
        </p>
      </div>
      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function PinKey({
  onClick,
  disabled,
  kids,
  children,
  ...rest
}: {
  onClick: () => void;
  disabled?: boolean;
  kids?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-[20px] font-semibold tabular-nums transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        kids
          ? "bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25"
          : "bg-canvas/55 text-ink ring-1 ring-edge-soft hover:bg-canvas/80"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
