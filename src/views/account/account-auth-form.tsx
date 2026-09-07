import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, KeyRound, Loader2, X } from "@/views/settings/icons";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { DiscordIcon } from "@/components/discord-icon";
import { loginIdentity, registerIdentity } from "@/lib/account/identity";
import {
  finishDiscordSignup,
  signInWithDiscord,
  startDiscordSignup,
} from "@/lib/account/discord-link";
import { accountErrorMessage, type AccountErrorMessage } from "@/lib/account/error-messages";
import { canDiscordAuth } from "@/lib/discord-auth";
import { PasswordField, TextField } from "./fields";
import { AccountRecoverForm } from "./account-recover-form";
import { AccountValueProps } from "./account-value-props";
import { useT } from "@/lib/i18n";
import { Section } from "@/views/settings/shared";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "@/views/settings/kit";

type Mode = "signin" | "register";

const MODES: { id: Mode; label: string; action: string }[] = [
  { id: "signin", label: "Sign in", action: "Sign in" },
  { id: "register", label: "Create account", action: "Create my account" },
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

// Errors that mean the Discord state/code itself is dead -- resubmitting
// with the same discordPending would just fail identically every time, so
// these clear it and send the user back to redo the Discord round-trip.
// Anything else (e.g. username_taken) is a fixable input mistake, so
// discordPending is deliberately left set for those.
const DISCORD_DEAD_CODES = new Set([
  "discord_code_invalid",
  "challenge_invalid",
  "discord_unreachable",
]);

function Shell({
  inline,
  closing,
  onDismiss,
  children,
  heading,
  subtitle,
  dismissible = false,
}: {
  inline: boolean;
  closing: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  heading?: string;
  subtitle?: string;
  dismissible?: boolean;
}) {
  const t = useT();
  if (!inline) {
    return (
      <ModalShell closing={closing} onDismiss={onDismiss}>
        {children}
      </ModalShell>
    );
  }
  return (
    <div className="hset-account-auth animate-lift-in relative w-full max-w-[560px] [&_label]:text-[16.5px] [&_label]:leading-6 [&_label~span]:text-[15.5px] [&_label~span]:leading-[22px] [&_input]:bg-elevated [&_input]:rounded-[10px]">
      {heading ? (
        <div className={dismissible ? "[&_.hset-section-title]:pe-14 [&_.harbor-settings-section>p]:pe-14" : undefined}>
          <Section title={heading} subtitle={subtitle}>{children}</Section>
        </div>
      ) : children}
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("Close")}
          className="absolute end-0 top-0 grid h-11 w-11 place-items-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function AccountAuthForm({
  onRecovery,
  onClose,
  inline = false,
  initialMode = "register",
}: {
  onRecovery?: (code: string) => void;
  onClose?: () => void;
  inline?: boolean;
  initialMode?: Mode;
}) {
  const t = useT();
  const { closing, close } = useModalExit(() => onClose?.());
  const switchRef = useRef<HTMLDivElement | null>(null);
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const prevMode = useRef(-1);
  const [view, setView] = useState<"auth" | "recover">("auth");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [error, setError] = useState<AccountErrorMessage | null>(null);
  // Set once Discord confirms identity for a fresh signup, cleared once the
  // account is actually created. While set, the username/password fields
  // below finish the Discord signup instead of a plain password one -- see
  // discord-link.ts's startDiscordSignup/finishDiscordSignup doc comment for
  // why this needs two steps instead of one.
  const [discordPending, setDiscordPending] = useState<{ state: string; code: string } | null>(
    null,
  );
  const canDiscord = canDiscordAuth();

  const trimmed = username.trim();
  const usernameOk = USERNAME_RE.test(trimmed);
  const passwordOk = mode === "register" ? password.length >= 8 : password.length > 0;
  const ready = usernameOk && passwordOk;
  const usernameHint =
    mode === "register" && trimmed.length > 0 && !usernameOk
      ? "3 to 24 letters, numbers, or underscores."
      : undefined;

  const submit = async () => {
    if (!ready || busy || discordBusy) return;
    setBusy(true);
    setError(null);
    try {
      if (discordPending) {
        const { recoveryCode } = await finishDiscordSignup(
          discordPending.state,
          discordPending.code,
          trimmed,
          password,
        );
        setDiscordPending(null);
        if (recoveryCode) onRecovery?.(recoveryCode);
      } else if (mode === "register") {
        const { recoveryCode } = await registerIdentity(trimmed, password);
        onRecovery?.(recoveryCode);
      } else {
        await loginIdentity(trimmed, password);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (discordPending && code && DISCORD_DEAD_CODES.has(code)) setDiscordPending(null);
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runDiscord = async () => {
    if (busy || discordBusy) return;
    setDiscordBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const { state, code } = await startDiscordSignup();
        // Discord already confirmed identity here -- whatever was typed
        // before clicking this button belonged to a different (abandoned)
        // signup attempt and must not silently carry over.
        setUsername("");
        setPassword("");
        setDiscordPending({ state, code });
      } else {
        await signInWithDiscord();
      }
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setDiscordBusy(false);
    }
  };

  const active = MODES.find((m) => m.id === mode)!;
  const modeIndex = MODES.findIndex((m) => m.id === mode);

  useLayoutEffect(() => {
    if (view !== "auth" || discordPending) return;
    const thumb = thumbRef.current;
    const to = modeRefs.current[modeIndex];
    if (!thumb || !to) return;
    const from = prevMode.current >= 0 ? modeRefs.current[prevMode.current] : null;
    prevMode.current = modeIndex;
    thumb.style.left = `${to.offsetLeft}px`;
    thumb.style.top = `${to.offsetTop}px`;
    thumb.style.width = `${to.offsetWidth}px`;
    thumb.style.height = `${to.offsetHeight}px`;
    thumb.style.opacity = "1";
    if (!from || from === to) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const edge = Math.min(from.offsetLeft, to.offsetLeft);
    const far = Math.max(from.offsetLeft + from.offsetWidth, to.offsetLeft + to.offsetWidth);
    thumb.animate(
      [
        { left: `${from.offsetLeft}px`, width: `${from.offsetWidth}px` },
        { left: `${edge}px`, width: `${far - edge}px`, offset: 0.48 },
        { left: `${to.offsetLeft}px`, width: `${to.offsetWidth}px` },
      ],
      { duration: 440, easing: "ease-in-out" },
    );
  }, [modeIndex, view, discordPending]);

  if (view === "recover") {
    return (
      <Shell inline={inline} closing={closing} onDismiss={close}>
        <div className="overflow-y-auto">
          <AccountRecoverForm
            inline={inline}
            onBack={() => setView("auth")}
            onReset={(code) => {
              setView("auth");
              onRecovery?.(code);
            }}
          />
        </div>
      </Shell>
    );
  }

  const heading = discordPending
    ? t("Choose your username")
    : mode === "register"
      ? t("Create your Harbor account")
      : t("Sign in to Harbor");
  const subtitle = discordPending
    ? t("Discord confirmed. Pick a username and password to finish.")
    : mode === "register"
      ? t("One free account for your handle, themes, and sync.")
      : t("Sign in to pick up where you left off.");

  return (
    <Shell inline={inline} closing={closing} onDismiss={close} heading={heading} subtitle={subtitle} dismissible={!!onClose}>
      {!inline && <div className="flex items-start gap-4 px-6 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-[20px] font-semibold leading-7 tracking-tight text-ink">
            {heading}
          </h2>
          <p className="text-[15px] leading-[22px] text-ink-muted">
            {subtitle}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={close}
            aria-label={t("Close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} />
          </button>
        )}
      </div>}

      <div className={inline ? "flex min-w-0 flex-col gap-6 pt-4" : "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6"}>
        {!inline && !discordPending && mode === "register" && <AccountValueProps />}

        {!discordPending && (
          <div
            ref={switchRef}
            className="relative flex items-center gap-1 rounded-md bg-canvas p-1"
          >
            <span
              ref={thumbRef}
              aria-hidden
              className="pointer-events-none absolute rounded-[4px] bg-ink opacity-0"
            />
            {MODES.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                ref={(el) => {
                  modeRefs.current[i] = el;
                }}
                onClick={() => {
                  setMode(m.id);
                  setError(null);
                }}
                className={`relative z-10 h-11 flex-1 rounded-[4px] text-[15px] font-semibold transition-colors duration-200 ${
                  mode === m.id ? "text-canvas" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label={t("Username")}
            value={username}
            onChange={setUsername}
            placeholder={t("yourname")}
            maxLength={24}
            hint={usernameHint ? t(usernameHint) : undefined}
            tone={usernameHint ? "danger" : "muted"}
            autoComplete="username"
          />
          <PasswordField
            label={t("Password")}
            value={password}
            onChange={setPassword}
            placeholder={mode === "register" ? t("At least 8 characters") : t("Your password")}
            onEnter={submit}
          />

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setView("recover");
                setError(null);
              }}
              className={inline ? "-mt-1 min-h-11 self-end text-[15px] font-medium text-ink-muted transition-colors hover:text-ink" : "-mt-1 min-h-11 self-end text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"}
            >
              {t("Forgot password?")}
            </button>
          )}

          {error && (
            <p role="alert" className={inline ? "rounded-md bg-danger/10 px-3.5 py-3 text-[15.5px] leading-[22px] text-danger" : "rounded-md bg-danger/10 px-3.5 py-2.5 text-[14px] leading-snug text-danger"}>
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          {(discordPending || mode === "register") && (
            <p className={inline ? "flex items-start gap-2.5 text-[15.5px] leading-[22px] text-ink-muted" : "flex items-start gap-2 rounded-md bg-canvas px-3.5 py-3 text-[14px] leading-[21px] text-ink-muted"}>
              <KeyRound size={13} className="mt-0.5 shrink-0" />
              {discordPending
                ? t(
                    "We'll show a one-time recovery key and send it to you on Discord. Save it: it's the only way back in if you forget your password.",
                  )
                : t(
                    "We'll show a one-time recovery key right after you sign up. Save it: it's the only way back in if you forget your password.",
                  )}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            {discordPending && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDiscordPending(null);
                  setError(null);
                }}
                className={inline ? ROW_ACTION : "text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink disabled:opacity-40"}
              >
                {t("Cancel")}
              </button>
            )}
            <button
              type="submit"
              disabled={!ready || busy || discordBusy}
              className={inline ? ROW_ACTION_PRIMARY : "harbor-press-pop flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-[15px] font-semibold text-canvas transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"}
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {discordPending ? t("Finish creating my account") : t(active.action)}
            </button>
          </div>
        </form>

        {!discordPending && canDiscord && (
          <>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-edge-soft" />
              <span className={inline ? "text-[15px] text-ink-muted" : "text-[11px] font-medium uppercase tracking-wide text-ink-subtle"}>
                {t("or")}
              </span>
              <span className="h-px flex-1 bg-edge-soft" />
            </div>
            <button
              type="button"
              onClick={() => void runDiscord()}
              disabled={busy || discordBusy}
              className={inline ? `${ROW_ACTION} justify-center` : "harbor-press-pop flex min-h-11 items-center justify-center gap-2 rounded-md bg-canvas px-4 py-2 text-[15px] font-semibold text-ink transition-colors hover:bg-elevated disabled:opacity-40"}
            >
              {discordBusy ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {t("Continue in your browser...")}
                </>
              ) : (
                <>
                  <DiscordIcon size={16} />
                  {mode === "register" ? t("Continue with Discord") : t("Sign in with Discord")}
                  <ExternalLink size={13} />
                </>
              )}
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}
