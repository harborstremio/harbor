import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, X } from "lucide-react";
import { useT } from "@/lib/i18n";

type SpeechResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultLike };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const EXIT_MS = 260;
const HOLD_CAPTURED = 460;
const HOLD_ERROR = 1150;

type Phase = "listening" | "captured" | "error";

const STYLES = `
@keyframes voice-in { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes voice-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: scale(0.99); } }
@keyframes voice-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
@keyframes voice-ripple { 0% { opacity: 0.5; transform: scale(0.7); } 100% { opacity: 0; transform: scale(1.85); } }
@keyframes voice-word-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
@keyframes voice-sweep { from { background-position: 220% 0; } to { background-position: -220% 0; } }
@keyframes voice-dot-pulse { 0%, 100% { opacity: 0.28; } 50% { opacity: 1; } }
.voice-overlay { animation: voice-in 300ms var(--ease-out) both; }
.voice-overlay-exit { animation: voice-out ${EXIT_MS}ms var(--ease-out) both; }
.voice-pulse { animation: voice-breathe 2.8s var(--ease-in-out) infinite; }
.voice-ring { animation: voice-ripple 2.6s var(--ease-out) infinite; }
.voice-ring-late { animation-delay: 1.3s; }
.voice-word { animation: voice-word-in 300ms var(--ease-out) both; }
.voice-dot { animation: voice-dot-pulse 1.25s var(--ease-in-out) infinite; }
.voice-dot-2 { animation-delay: 0.16s; }
.voice-dot-3 { animation-delay: 0.32s; }
.voice-hint-shimmer {
  background: linear-gradient(100deg, var(--color-ink-subtle) 42%, var(--color-ink-muted) 50%, var(--color-ink-subtle) 58%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: voice-sweep 2.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .voice-overlay, .voice-overlay-exit, .voice-pulse, .voice-ring, .voice-word, .voice-dot { animation: none !important; }
  .voice-hint-shimmer {
    animation: none;
    background: none;
    -webkit-text-fill-color: var(--color-ink-subtle);
    color: var(--color-ink-subtle);
  }
}
`;

export function VoiceSearch({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (transcript: string) => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("listening");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [exiting, setExiting] = useState(false);
  const [reduced] = useState(reducedMotion);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const terminalRef = useRef(false);
  const leavingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const onCloseRef = useRef(onClose);
  const onSubmitRef = useRef(onSubmit);
  onCloseRef.current = onClose;
  onSubmitRef.current = onSubmit;

  const stopRec = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {}
  }, []);

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    stopRec();
    setExiting(true);
    timersRef.current.push(window.setTimeout(() => onCloseRef.current(), EXIT_MS));
  }, [stopRec]);

  const settle = useCallback(
    (next: "captured" | "error", text: string) => {
      if (terminalRef.current) return;
      terminalRef.current = true;
      stopRec();
      if (next === "captured") {
        setFinalText(text);
        setInterim(text);
        setPhase("captured");
        onSubmitRef.current(text);
      } else {
        setPhase("error");
      }
      timersRef.current.push(
        window.setTimeout(leave, next === "captured" ? HOLD_CAPTURED : HOLD_ERROR),
      );
    },
    [stopRec, leave],
  );

  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      settle("error", "");
    } else {
      let rec: SpeechRecognitionLike | null = null;
      try {
        rec = new SR();
      } catch {
        rec = null;
      }
      if (!rec) {
        settle("error", "");
      } else {
        rec.lang = navigator.language || "en-US";
        rec.interimResults = true;
        rec.continuous = false;
        rec.onresult = (event) => {
          let live = "";
          let done = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) done += res[0].transcript;
            else live += res[0].transcript;
          }
          const heard = done.trim();
          if (heard) settle("captured", heard);
          else setInterim(live);
        };
        rec.onerror = (event) => {
          if (event.error === "aborted") return;
          settle("error", "");
        };
        rec.onend = () => settle("error", "");
        recRef.current = rec;
        try {
          rec.start();
        } catch {}
      }
    }
    return () => {
      stopRec();
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [settle, stopRec]);

  const words = interim ? interim.trim().split(/\s+/).filter(Boolean) : [];
  const bigType = "font-display leading-tight tracking-tight text-[clamp(1.5rem,6.4vw,2.15rem)]";

  return (
    <div
      role="dialog"
      aria-label={t("Voice search")}
      onClick={leave}
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center px-8 ${
        exiting ? "voice-overlay-exit" : "voice-overlay"
      }`}
      style={{
        background: "color-mix(in oklch, var(--color-canvas) 84%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <style>{STYLES}</style>

      <button
        type="button"
        aria-label={t("Cancel")}
        onClick={(e) => {
          e.stopPropagation();
          leave();
        }}
        className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-elevated/70 text-ink-muted transition-transform duration-100 active:scale-90"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <X size={20} strokeWidth={2.2} />
      </button>

      <div className="flex flex-col items-center gap-7">
        <div className="relative grid h-[92px] w-[92px] place-items-center">
          {phase === "listening" && !reduced && (
            <>
              <span
                aria-hidden
                className="voice-ring absolute inset-0 rounded-full border-[1.5px] border-accent"
              />
              <span
                aria-hidden
                className="voice-ring voice-ring-late absolute inset-0 rounded-full border-[1.5px] border-accent"
              />
            </>
          )}
          <span
            className={`relative grid h-[92px] w-[92px] place-items-center rounded-full transition-colors duration-300 ${
              phase === "error" ? "bg-elevated" : "bg-accent"
            } ${phase === "listening" && !reduced ? "voice-pulse" : ""}`}
            style={{ boxShadow: "0 12px 34px -14px rgba(0,0,0,0.66)" }}
          >
            {phase === "captured" ? (
              <Check size={38} strokeWidth={2.4} className="text-canvas" />
            ) : phase === "error" ? (
              <MicOff size={34} strokeWidth={2.1} className="text-ink-subtle" />
            ) : (
              <Mic size={36} strokeWidth={2.2} className="text-canvas" />
            )}
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {phase === "listening" && (
              <>
                <span>{t("Listening")}</span>
                <span className="inline-flex items-center gap-[3px] pb-[1px]">
                  <span className="voice-dot h-[3px] w-[3px] rounded-full bg-ink-muted" />
                  <span className="voice-dot voice-dot-2 h-[3px] w-[3px] rounded-full bg-ink-muted" />
                  <span className="voice-dot voice-dot-3 h-[3px] w-[3px] rounded-full bg-ink-muted" />
                </span>
              </>
            )}
            {phase === "captured" && <span className="text-accent">{t("Got it")}</span>}
            {phase === "error" && <span>{t("Didn't catch that")}</span>}
          </div>

          <div className="flex min-h-[92px] max-w-[16rem] items-center justify-center">
            {phase === "captured" ? (
              <p className={`${bigType} text-ink`}>{finalText}</p>
            ) : phase === "error" ? null : words.length > 0 ? (
              <p className={`${bigType} text-ink-muted`}>
                {reduced
                  ? interim
                  : words.map((w, i) => (
                      <span
                        key={i}
                        className="voice-word inline-block"
                        style={{ marginRight: "0.26em" }}
                      >
                        {w}
                      </span>
                    ))}
              </p>
            ) : (
              <p
                className={`font-display leading-snug tracking-tight text-[clamp(1.35rem,5.6vw,1.9rem)] ${
                  reduced ? "text-ink-subtle" : "voice-hint-shimmer"
                }`}
              >
                {t("Say a title, actor, or genre")}
              </p>
            )}
          </div>
        </div>
      </div>

      {phase === "listening" && (
        <p
          className="absolute inset-x-0 bottom-0 text-center text-[12.5px] text-ink-subtle"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
        >
          {t("Tap anywhere to cancel")}
        </p>
      )}
    </div>
  );
}
