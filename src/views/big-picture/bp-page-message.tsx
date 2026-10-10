import { SFX } from "@/lib/sfx";

const COLUMN = "max-w-[min(36vw,410px)]";

const TITLE =
  "font-display text-[clamp(30px,4.7vh,44px)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink";

const BODY = "mt-[15px] text-[clamp(15px,1.9vh,22px)] leading-[1.6] text-ink-muted";

const ACTION =
  "mt-[28px] flex h-[47px] items-center self-start rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[17px] text-[13.4px] font-semibold text-ink transition-[background-color,border-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] motion-reduce:transition-none";

export function BpPageMessage({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center px-[var(--bp-gutter)]">
      <div className={COLUMN}>
        <h2 className={TITLE}>{title}</h2>
        <p className={BODY}>{body}</p>
      </div>
      {action && onAction && (
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          data-bp-autofocus="true"
          onClick={() => {
            SFX.click();
            onAction();
          }}
          className={ACTION}
        >
          {action}
        </button>
      )}
    </div>
  );
}
