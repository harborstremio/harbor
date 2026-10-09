import { Component, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { exitBigPicture, resetBigPictureToHome } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { bpOverscan } from "./bp-safe-area";
import { ensureBigPictureTokens } from "./bp-tokens";

type Props = { children: ReactNode };
type State = { crashed: boolean };

const ACTION =
  "flex h-[clamp(56px,7vh,74px)] shrink-0 items-center rounded-[var(--bp-r-md)] border px-[clamp(24px,2.4vw,44px)] text-[clamp(17px,2.3vh,24px)] font-semibold outline-none";

const PRIMARY = `${ACTION} border-transparent bg-[var(--bp-on)] text-ink focus:bg-[var(--color-ink)] focus:text-[var(--color-canvas)]`;

const GHOST = `${ACTION} border-[var(--bp-edge-2)] text-ink focus:border-transparent focus:bg-[var(--color-ink)] focus:text-[var(--color-canvas)]`;

/**
 * The crash screen, and it is a screen rather than a return of null.
 *
 * componentDidCatch used to call exitBigPicture(), which drops the viewer into
 * the desktop tree. That tree has no D-pad model, so on a stick a render error
 * read as the app going black and then becoming undrivable. It also unmounted
 * this boundary on the way past, because App gates it on the same active flag,
 * so the fallback below could never have painted even if it had existed.
 *
 * Nothing here may lean on the shell: the shell is what just died. Tokens are
 * re-ensured, the root attribute is spelled again so var(--bp-*) resolves, and
 * the ring is real DOM focus, because the focus engine went down with the tree.
 */
function BpCrashSurface({ onRetry }: { onRetry: () => void }) {
  const t = useBpT();
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const leaveRef = useRef<HTMLButtonElement | null>(null);

  // Layout, not passive. The sheet has to be in the head before the first paint
  // or the crash screen paints once with every var(--bp-*) unresolved, which is
  // a black rectangle: the exact thing this surface exists to replace.
  useLayoutEffect(() => {
    ensureBigPictureTokens();
    retryRef.current?.focus();
  }, []);

  const overscan = bpOverscan();
  const style: CSSProperties | undefined =
    overscan > 0 ? ({ "--bp-overscan": String(overscan) } as CSSProperties) : undefined;

  // The engine unmounted with the shell, so nothing on the page answers an
  // arrow. Without this the ring can reach the first button and the second one
  // is unreachable from a remote. Absolute targets rather than a spatial rank:
  // there are two controls and a crash screen is the wrong place to be clever.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    const on = back || e.key === "ArrowRight" || e.key === "ArrowDown";
    if (!on) return;
    e.preventDefault();
    e.stopPropagation();
    (back ? retryRef : leaveRef).current?.focus();
  };

  return (
    <div
      data-bp-root
      role="alertdialog"
      aria-label={t("Something went wrong.")}
      onKeyDown={onKeyDown}
      style={style}
      className="fixed inset-0 z-[900] flex flex-col items-center justify-center gap-[clamp(16px,2.2vh,32px)] bg-[var(--bp-void)] px-[var(--bp-gutter)] py-[var(--bp-safe-y,0px)] text-center text-ink [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
    >
      <h1 className="font-display text-[clamp(32px,4.4vh,58px)] font-semibold leading-[1.06] tracking-[-0.02em]">
        {t("Something went wrong.")}
      </h1>
      <p className="max-w-[44ch] text-[clamp(17px,2.3vh,26px)] font-medium leading-snug text-ink-subtle">
        {t("This screen stopped. Going back to Home usually clears it.")}
      </p>
      <div className="mt-[clamp(6px,1vh,16px)] flex items-center gap-[clamp(12px,1.2vw,22px)]">
        <button
          ref={retryRef}
          type="button"
          data-bp-focusable
          data-bp-autofocus="true"
          onClick={() => {
            SFX.click();
            onRetry();
          }}
          className={PRIMARY}
        >
          {t("Home")}
        </button>
        <button
          ref={leaveRef}
          type="button"
          data-bp-focusable
          onClick={() => {
            SFX.close();
            exitBigPicture();
          }}
          className={GHOST}
        >
          {t("Leave Big Picture")}
        </button>
      </div>
    </div>
  );
}

export class BpErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("[big-picture] crashed", error);
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return (
        <BpCrashSurface
          onRetry={() => {
            resetBigPictureToHome();
            this.setState({ crashed: false });
          }}
        />
      );
    }
    return this.props.children;
  }
}
