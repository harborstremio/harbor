import { AlertCircle, Check, Loader2, Tv, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import {
  LanPairSession,
  PAIR_CODE_LEN,
  normalizePairCode,
  pairFailureText,
  type LanSelf,
} from "@/lib/lan-trust";
import { harborIdentity, platformLabel, type HarborInstance } from "./play-on-lan";

type PairPhase =
  | { kind: "opening" }
  | { kind: "entering"; expiresAt: number; len: number }
  | { kind: "checking"; expiresAt: number; len: number }
  | { kind: "done"; name: string }
  | { kind: "failed"; code: string };

const RETRYABLE = new Set(["badCode", "expired", "gone", "no-response", "unreachable", "busy"]);

let target: HarborInstance | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function openPairFlow(instance: HarborInstance): void {
  target = instance;
  emit();
}

export function closePairFlow(): void {
  if (!target) return;
  target = null;
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): HarborInstance | null {
  return target;
}

export function usePairFlowTarget(): HarborInstance | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function PlayOnPairHost() {
  const instance = usePairFlowTarget();
  if (!instance) return null;
  return <PairPanel key={instance.id} instance={instance} />;
}

function countdown(expiresAt: number, now: number): string {
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function PairPanel({ instance }: { instance: HarborInstance }) {
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<PairPhase>({ kind: "opening" });
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const session = useRef<LanPairSession | null>(null);
  const alive = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    alive.current = true;
    let started: LanPairSession | null = null;
    void (async () => {
      const me = await harborIdentity();
      if (!alive.current) return;
      const self: LanSelf | null = me
        ? { id: me.id, name: me.name, platform: me.platform, version: me.version }
        : null;
      started = new LanPairSession(
        { id: instance.id, host: instance.host, port: instance.port },
        self,
      );
      session.current = started;
      const begun = await started.open();
      if (!alive.current) return;
      if (!begun.ok) {
        setPhase({ kind: "failed", code: begun.code });
        return;
      }
      setPhase({ kind: "entering", expiresAt: begun.expiresAt, len: begun.len });
    })();
    return () => {
      alive.current = false;
      started?.close();
      session.current = null;
    };
  }, [instance.id, instance.host, instance.port, attempt]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePairFlow();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (phase.kind !== "entering") return;
    fieldRef.current?.focus({ preventScroll: true });
  }, [phase.kind]);

  const expiresAt = phase.kind === "entering" || phase.kind === "checking" ? phase.expiresAt : 0;
  const len = phase.kind === "entering" || phase.kind === "checking" ? phase.len : PAIR_CODE_LEN;

  useEffect(() => {
    if (!expiresAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [expiresAt]);

  useEffect(() => {
    if (phase.kind !== "entering" || !expiresAt || now < expiresAt) return;
    session.current?.close();
    setPhase({ kind: "failed", code: "expired" });
  }, [phase.kind, expiresAt, now]);

  const clean = normalizePairCode(typed);
  const ready = clean.length === len && phase.kind === "entering";

  const submit = useCallback(async () => {
    const live = session.current;
    if (!live) return;
    setPhase((prev) =>
      prev.kind === "entering"
        ? { kind: "checking", expiresAt: prev.expiresAt, len: prev.len }
        : prev,
    );
    const result = await live.submit(clean);
    if (!alive.current) return;
    if (result.ok) {
      setPhase({ kind: "done", name: result.peer.name || instance.name });
      window.setTimeout(() => closePairFlow(), 900);
      return;
    }
    setPhase({ kind: "failed", code: result.code });
  }, [clean, instance.name]);

  const retry = useCallback(() => {
    session.current?.close();
    setTyped("");
    setPhase({ kind: "opening" });
    setAttempt((n) => n + 1);
  }, []);

  const label = instance.name?.trim() || t("Harbor");
  const where = `${platformLabel(instance.platform)} / ${instance.host}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-canvas/75 p-6 backdrop-blur-[3px] animate-fade-in motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-label={t("Pair with this Harbor")}
      onMouseDown={closePairFlow}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-[400px] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_28px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-edge-soft outline-none animate-popover-in motion-reduce:animate-none"
      >
        <header className="flex items-start gap-3 border-b border-edge-soft px-5 py-4">
          <span className="mt-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink-muted">
            <Tv size={19} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-ink">{label}</h2>
            <p className="truncate text-[12.5px] text-ink-subtle">{where}</p>
          </div>
          <button
            type="button"
            onClick={closePairFlow}
            aria-label={t("Close")}
            className="-me-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="px-5 py-5">
          <PairBody
            phase={phase}
            typed={clean}
            len={len}
            ready={ready}
            left={expiresAt ? countdown(expiresAt, now) : ""}
            fieldRef={fieldRef}
            onTyped={(value) => setTyped(normalizePairCode(value).slice(0, len))}
            onSubmit={() => void submit()}
            onRetry={retry}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PairBody({
  phase,
  typed,
  len,
  ready,
  left,
  fieldRef,
  onTyped,
  onSubmit,
  onRetry,
}: {
  phase: PairPhase;
  typed: string;
  len: number;
  ready: boolean;
  left: string;
  fieldRef: React.RefObject<HTMLInputElement | null>;
  onTyped: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  const t = useT();

  if (phase.kind === "opening") {
    return (
      <p className="flex min-h-[44px] items-center gap-2.5 text-[13px] text-ink-muted">
        <Loader2 size={15} strokeWidth={2.2} className="animate-spin motion-reduce:animate-none" />
        {t("Asking that Harbor to show a code")}
      </p>
    );
  }

  if (phase.kind === "done") {
    return (
      <p className="flex min-h-[44px] items-center gap-2.5 text-[13px] font-medium text-ink">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Check size={17} strokeWidth={2.5} />
        </span>
        {t("Paired with {name}").replace("{name}", phase.name)}
      </p>
    );
  }

  if (phase.kind === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-danger">
          <AlertCircle size={16} strokeWidth={2} className="mt-[2px] shrink-0" />
          <span>{t(pairFailureText(phase.code))}</span>
        </p>
        <div className="flex items-center gap-2.5">
          {RETRYABLE.has(phase.code) ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-11 rounded-xl bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
            >
              {t("Try again")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={closePairFlow}
            className="h-11 rounded-xl border border-edge px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            {t("Close")}
          </button>
        </div>
      </div>
    );
  }

  const checking = phase.kind === "checking";

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
    >
      <label htmlFor="harbor-pair-code" className="text-[13px] leading-relaxed text-ink-muted">
        {t("Type the code showing on that Harbor.")}
      </label>
      <input
        id="harbor-pair-code"
        ref={fieldRef}
        value={typed}
        onChange={(e) => onTyped(e.target.value)}
        disabled={checking}
        maxLength={len}
        inputMode="text"
        autoComplete="one-time-code"
        spellCheck={false}
        aria-describedby="harbor-pair-hint"
        className="h-14 w-full rounded-xl border border-edge bg-canvas/60 px-4 text-center text-[22px] font-semibold tracking-[0.3em] text-ink outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 motion-reduce:transition-none"
      />
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <span className="text-[12px] text-ink-subtle">
          {left ? t("Code expires in {left}").replace("{left}", left) : ""}
        </span>
        <button
          type="submit"
          disabled={!ready}
          className="flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
        >
          {checking ? (
            <Loader2
              size={15}
              strokeWidth={2.2}
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {checking ? t("Checking") : t("Pair")}
        </button>
      </div>
      <p id="harbor-pair-hint" className="text-[11.5px] leading-relaxed text-ink-subtle">
        {t("Until you pair, that Harbor ignores anything this computer sends it.")}
      </p>
    </form>
  );
}
