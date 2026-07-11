import { useT } from "@/lib/i18n";
import { ChevronLeft, Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Stage = "enter" | "confirm";

export function PinEntry({
  title,
  subtitle,
  mode,
  onComplete,
  onBack,
  verify,
}: {
  title: string;
  subtitle: string;
  mode: "set" | "verify";
  onComplete: (pin: string) => Promise<boolean | void> | boolean | void;
  onBack: () => void;
  verify?: (pin: string) => Promise<boolean>;
}) {
  const t = useT();
  const [stage, setStage] = useState<Stage>("enter");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const focus = () => inputRef.current?.focus();

  useEffect(() => {
    const id = setTimeout(focus, 40);
    return () => clearTimeout(id);
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
      if (mode === "verify") {
        if (!verify) return;
        setBusy(true);
        const ok = await verify(pin);
        if (cancelled) return;
        setBusy(false);
        if (ok) {
          await onComplete(pin);
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
      await onComplete(pin);
      if (cancelled) return;
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pin]);

  const tap = (digit: string) => {
    if (busy) return;
    setError(null);
    setPin((p) => (p.length >= 4 ? p : p + digit));
    focus();
  };
  const backspace = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
    focus();
  };

  const displayTitle = mode === "set" && stage === "confirm" ? t("Confirm your PIN") : title;
  const displaySub = mode === "set" && stage === "confirm" ? t("Type the same 4-digit PIN again.") : subtitle;

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-7 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated/40 hover:text-ink"
          aria-label={t("common.back")}
        >
          <ChevronLeft size={14} strokeWidth={2.2} className="dir-icon" />
          {t("common.back")}
        </button>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">{t("Profile PIN")}</span>
        <h1 className="font-display text-[28px] font-medium tracking-tight text-ink">{displayTitle}</h1>
        <p className="text-center text-[13.5px] text-ink-muted">{displaySub}</p>
      </div>

      <div className={`flex flex-col items-center gap-5 ${shake ? "animate-[pin-shake_0.34s_ease]" : ""}`}>
        <button
          type="button"
          onClick={focus}
          aria-label={t("Focus PIN entry")}
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
              className={`pointer-events-none h-3.5 w-3.5 rounded-full ring-1 transition-all ${
                pin.length > i ? "scale-110 bg-ink ring-ink" : "bg-transparent ring-edge-soft"
              }`}
            />
          ))}
        </button>
        {error && <p className="text-[12.5px] font-medium text-red-300">{error}</p>}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PinKey key={d} onClick={() => tap(d)} disabled={busy}>
              {d}
            </PinKey>
          ))}
          <span className="h-12 w-12" />
          <PinKey onClick={() => tap("0")} disabled={busy}>
            0
          </PinKey>
          <PinKey onClick={backspace} disabled={busy || pin.length === 0} aria-label={t("Delete")}>
            <Delete size={18} strokeWidth={1.8} />
          </PinKey>
        </div>
      </div>

      <p className="text-center text-[11.5px] text-ink-subtle">{t("Type on your keyboard or tap the digits above.")}</p>
      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

function PinKey({
  onClick,
  disabled,
  children,
  ...rest
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas/55 text-[20px] font-medium tabular-nums text-ink ring-1 ring-edge-soft transition-all hover:bg-canvas/80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}
