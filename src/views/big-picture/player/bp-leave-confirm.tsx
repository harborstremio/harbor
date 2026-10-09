import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import {
  closeLeaveConfirm,
  getLeaveConfirm,
  subscribeLeaveConfirm,
} from "@/lib/player/leave-confirm";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { ensureBigPictureTokens } from "../bp-tokens";
import { currentBpFocus, setBpFocus, type BpDir } from "../use-bp-focus";

const BTN = "clamp(52px, 6vh, 72px)";
const CHIP =
  "flex shrink-0 items-center justify-center gap-[clamp(6px,0.6vw,11px)] border border-[var(--bp-edge-2)] font-semibold text-ink";
const CHIP_STYLE: CSSProperties = {
  height: BTN,
  paddingInline: "clamp(22px, 2.2vh, 40px)",
  borderRadius: "var(--bp-r-md)",
  fontSize: "clamp(16px, 2.1vh, 23px)",
};

export function BpLeaveConfirm() {
  const t = useBpT();
  const state = useSyncExternalStore(subscribeLeaveConfirm, getLeaveConfirm);
  const [remember, setRemember] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => ensureBigPictureTokens(), []);

  useEffect(() => {
    if (state.open) setRemember(false);
  }, [state.open]);

  const close = useCallback(() => {
    SFX.close();
    closeLeaveConfirm();
  }, []);

  useEffect(() => {
    if (!state.open) return;
    return pushBpBack(() => {
      closeLeaveConfirm();
      return true;
    });
  }, [state.open]);

  const step = useCallback((dir: BpDir): boolean => {
    const root = rootRef.current;
    if (!root) return false;
    const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-bp-focusable]"));
    if (cells.length === 0) return false;
    if (dir === "up" || dir === "down") return true;
    const rtl = getComputedStyle(root).direction === "rtl";
    const forward = rtl ? dir === "left" : dir === "right";
    const at = cells.findIndex((el) => el.dataset.bpFocus === "true");
    const want = at < 0 ? 0 : at + (forward ? 1 : -1);
    const next = cells[Math.min(cells.length - 1, Math.max(0, want))];
    if (next && next !== cells[at]) setBpFocus(next, { dir });
    return true;
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const dirs: Record<string, BpDir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = dirs[e.key];
      if (dir) {
        e.preventDefault();
        e.stopImmediatePropagation();
        step(dir);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const el = currentBpFocus(rootRef.current);
        if (el) {
          SFX.click();
          el.click();
        }
        return;
      }
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [state.open, step, close]);

  useEffect(() => {
    if (!state.open) return;
    const root = rootRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>("[data-bp-focusable]");
    if (first) setBpFocus(first, { silent: true });
  }, [state.open]);

  if (!state.open) return null;

  const leave = () => {
    const fn = state.onConfirm;
    closeLeaveConfirm();
    fn?.(remember);
  };

  return createPortal(
    <div
      ref={rootRef}
      data-bp-root
      data-bp-overlay="true"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[950] grid place-items-center px-[var(--bp-gutter)] text-ink"
      style={{ background: "color-mix(in oklab, var(--bp-void) 88%, transparent)" }}
    >
      <div
        data-bp-dialog
        className="relative flex w-[clamp(360px,34vw,600px)] max-w-full flex-col items-center gap-[clamp(14px,1.8vh,28px)] p-[clamp(24px,2.8vh,46px)] text-center [animation:bp-rise_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
        style={{
          borderRadius: "var(--bp-r-lg)",
          border: "1px solid var(--bp-edge-2)",
          background: "var(--bp-panel-2)",
          boxShadow: "0 40px 120px -30px rgba(0, 0, 0, 0.9)",
        }}
      >
        <div className="flex flex-col items-center gap-[clamp(5px,0.7vh,11px)]">
          <h2
            className="font-display text-ink"
            style={{ fontSize: "clamp(28px, 3.7vh, 40px)", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.015em" }}
          >
            {t("Leave the show?")}
          </h2>
          <p
            className="text-ink-muted"
            style={{ maxWidth: "34ch", fontSize: "clamp(16px, 2.2vh, 23px)", lineHeight: 1.45 }}
          >
            {t("We'll save your spot so you can pick up right where you left off.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-[clamp(10px,1.2vh,20px)]">
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            onClick={close}
            className={CHIP}
            style={CHIP_STYLE}
          >
            {t("Keep watching")}
          </button>
          <button type="button" data-bp-focusable data-bp-chip onClick={leave} className={CHIP} style={CHIP_STYLE}>
            {t("Leave")}
          </button>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            aria-pressed={remember}
            onClick={() => setRemember((r) => !r)}
            className={CHIP}
            style={CHIP_STYLE}
          >
            {remember ? <Check size={19} strokeWidth={2.6} /> : null}
            {t("Don't ask again")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
