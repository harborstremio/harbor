import { forwardRef, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { HandoffClientReject } from "@/lib/tv-handoff/handoff-client";
import type { DeliveryState } from "./use-setup-link";
import { SETUP_MOTION_CSS } from "./setup-motion";

export const SETUP_CSS = `
.setup-rise {
  animation: setup-rise 320ms var(--ease-out) both;
}
@keyframes setup-rise {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to { opacity: 1; transform: none; }
}
.setup-pip {
  animation: setup-pip 2.4s ease-in-out infinite;
}
@keyframes setup-pip {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .setup-rise { animation: none; }
  .setup-pip { animation: none; }
}
${SETUP_MOTION_CSS}`;

export function SetupCard({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="setup-rise rounded-2xl border border-edge-soft bg-surface p-4">
      {title && <h2 className="text-[17px] font-semibold leading-snug text-ink">{title}</h2>}
      {hint && <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{hint}</p>}
      <div className={title || hint ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function SetupHeading({ title, body }: { title: string; body?: string }) {
  return (
    <header className="setup-rise">
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
      {body && <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>}
    </header>
  );
}

/**
 * The keyboard's Go and Next keys are painted by enterKeyHint on every field
 * here and used to do nothing at all, which bites hardest on iOS Safari where
 * the keyboard overlays the docked action button rather than shrinking the
 * page. Implicit submission needs a submit control inside the form, and the
 * real one lives in the shell's action bar outside it, so this carries a
 * hidden one.
 */
export function SetupForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  const go = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit();
  };
  return (
    <form onSubmit={go} className="flex flex-col gap-4">
      {children}
      <button type="submit" tabIndex={-1} aria-hidden className="sr-only" />
    </form>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "quiet";
  type?: "button" | "submit";
};

export function SetupButton({
  children,
  onClick,
  disabled,
  busy,
  variant = "primary",
  type = "button",
}: ButtonProps) {
  const base =
    "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl px-5 text-[16px] font-semibold transition-[transform,opacity] duration-150 active:scale-[0.985] disabled:opacity-45 motion-reduce:active:scale-100";
  const skin =
    variant === "primary"
      ? "bg-accent text-canvas"
      : "border border-edge bg-elevated text-ink";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`${base} ${skin}`}
    >
      {busy && <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}

/**
 * One form for every external link in this flow. A real user-activated anchor
 * is never popup-blocked; a button calling window.open is, and when it is the
 * tap can navigate the current tab instead, which is how js ended up stranded
 * on themoviedb.org with no way back to setup. preventDefault plus openUrl
 * keeps the Tauri path, where the url has to go to the OS browser rather than
 * a webview tab.
 */
export function SetupLinkOut({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!("__TAURI_INTERNALS__" in window)) return;
        e.preventDefault();
        openUrl(href);
      }}
      className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-edge bg-elevated px-4 py-3 text-start transition-transform duration-150 active:scale-[0.985] motion-reduce:active:scale-100"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15.5px] font-semibold text-ink">{label}</span>
        <span className="text-[13px] text-ink-subtle">{detail}</span>
      </span>
      <ExternalLink size={18} className="shrink-0 text-ink-subtle" />
    </a>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  mono?: boolean;
  autoFocus?: boolean;
  enterKeyHint?: "next" | "done" | "go";
  /** An explicit inputmode beats the input type when a phone picks a keyboard,
      so an email field left on "text" is handed the layout with @ two taps
      deep. Default stays "text" to protect the API key field. */
  inputMode?: "text" | "email";
  invalid?: boolean;
};

export const SetupField = forwardRef<HTMLInputElement, FieldProps>(function SetupField(
  {
    label,
    hint,
    value,
    onChange,
    placeholder,
    type = "text",
    autoComplete,
    mono,
    autoFocus,
    enterKeyHint = "done",
    inputMode = "text",
    invalid,
  },
  ref,
) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        enterKeyHint={enterKeyHint}
        className={`min-h-[56px] w-full rounded-xl border bg-elevated px-4 text-[17px] text-ink outline-none placeholder:text-ink-subtle focus:border-accent ${
          mono ? "font-mono tracking-[0.02em]" : ""
        } ${invalid ? "border-danger" : "border-edge"}`}
      />
      {hint && <span className="mt-2 block text-[13px] text-ink-subtle">{hint}</span>}
    </label>
  );
});

export function SetupError({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
      <span>{children}</span>
    </p>
  );
}

export function SetupOk({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
      <Check size={17} className="mt-0.5 shrink-0 text-success" />
      <span>{children}</span>
    </p>
  );
}

/**
 * One place for every way a delivery can fail. `badPayload` matters most: it
 * means the TV refused the shape of the value, which is what a v4 read token or
 * an unusual handle produces, and a generic timeout hid that forever.
 */
export function SetupDeliveryError({
  delivery,
  reject,
}: {
  delivery: DeliveryState;
  reject: HandoffClientReject | null;
}) {
  const t = useT();
  if (delivery === "timeout") {
    return (
      <SetupError>
        {t("Your TV did not confirm that. Check it is still on the setup screen.")}
      </SetupError>
    );
  }
  if (delivery === "offline") {
    return <SetupError>{t("Lost the connection to your TV. Reconnecting.")}</SetupError>;
  }
  if (delivery !== "rejected") return null;
  if (reject === "badPayload") {
    return (
      <SetupError>
        {t("Your TV would not accept that value. Check it for stray characters and try again.")}
      </SetupError>
    );
  }
  if (reject === "expired" || reject === "lockedOut" || reject === "noOffer") {
    return (
      <SetupError>
        {t("That code is no longer valid. Look at your TV for a new one.")}
      </SetupError>
    );
  }
  if (reject === "boundElsewhere") {
    return (
      <SetupError>{t("Another phone is already setting this TV up.")}</SetupError>
    );
  }
  if (reject === "applyFailed") {
    return (
      <SetupError>
        {t("Your TV could not use that. It may have been rejected on the TV's side.")}
      </SetupError>
    );
  }
  return <SetupError>{t("Your TV refused that. Try again.")}</SetupError>;
}

export function SetupWalkthrough({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised text-[12.5px] font-bold text-ink-muted">
            {i + 1}
          </span>
          <span className="text-[14.5px] leading-relaxed text-ink-muted">{s}</span>
        </li>
      ))}
    </ol>
  );
}
