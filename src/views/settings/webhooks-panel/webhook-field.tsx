import { AlertTriangle, Check, ChevronRight, ExternalLink, Loader2 } from "../icons";
import { openUrl } from "@/lib/window";
import { useId, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_PRIMARY } from "../kit";
import { ROW_DESC } from "../shared";
import { SButton } from "../ui";

export type FieldStatus = { state: "idle" | "busy" | "ok" | "error"; message: string | null };

export const FIELD_LABEL = "text-[15px] font-medium leading-[22px] text-ink";

export const FIELD_BOX =
  "flex min-h-[56px] w-full flex-wrap items-center gap-2.5 rounded-[10px] border border-edge-soft bg-elevated px-3 transition-colors focus-within:border-edge";

export const FIELD_INPUT =
  "h-11 min-w-[220px] flex-1 bg-transparent text-[16.5px] tracking-wide text-ink outline-none placeholder:text-ink-subtle/55";

export const FIELD_HELP = `flex max-w-[70ch] flex-col gap-3 ${ROW_DESC}`;

export function WebhookField({
  label,
  logo,
  placeholder,
  value,
  onChange,
  onTest,
  status,
  help,
}: {
  label: string;
  logo?: ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onTest: () => void;
  status: FieldStatus;
  help: ReactNode;
}) {
  const t = useT();
  const fieldId = useId();
  const busy = status.state === "busy";
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {logo}
          <label htmlFor={fieldId} className={FIELD_LABEL}>{label}</label>
        </span>
        <StatusBadge status={status} />
      </div>
      <div className={FIELD_BOX}>
        <input
          id={fieldId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className={FIELD_INPUT}
        />
        <button
          type="button"
          onClick={busy ? undefined : onTest}
          aria-disabled={busy}
          disabled={!value || busy}
          className={`${ROW_ACTION_PRIMARY} my-1.5${busy ? " pointer-events-none opacity-40" : ""}`}
        >
          {busy && <Loader2 size={17} strokeWidth={2.4} className="shrink-0 animate-spin" />}
          {t("Send test")}
        </button>
      </div>
      <SetupHelp label={t("How to connect Discord")}>{help}</SetupHelp>
    </div>
  );
}

export function StatusBadge({ status }: { status: FieldStatus }) {
  const t = useT();
  if (status.state === "idle") return null;
  const tone =
    status.state === "ok"
      ? "text-success"
      : status.state === "error"
        ? "text-danger"
        : "text-ink-muted";
  return (
    <span
      role={status.state === "error" ? "alert" : "status"}
      className={`flex items-center gap-2 text-[15.5px] font-medium leading-[22px] ${tone}`}
    >
      {status.state === "ok" && <Check size={17} strokeWidth={2.6} className="shrink-0" />}
      {status.state === "error" && (
        <AlertTriangle size={16} strokeWidth={2.4} className="shrink-0" />
      )}
      {status.state === "busy" && (
        <Loader2 size={16} strokeWidth={2.4} className="shrink-0 animate-spin" />
      )}
      {status.message ? t(status.message) : null}
    </span>
  );
}

export function SetupHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group max-w-[70ch]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[6px] text-[15px] font-medium text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} className="shrink-0 transition-transform group-open:rotate-90 rtl:rotate-180" />
        {label}
      </summary>
      <div className={`${FIELD_HELP} pb-4 ps-6`}>{children}</div>
    </details>
  );
}

export function DiscordTutorial() {
  const t = useT();
  return (
    <>
      <p className="max-w-[70ch]">
        {t(
          "Discord posts a message to a channel whenever Harbor pings it. Takes about a minute to set up.",
        )}
      </p>
      <ol className="ms-5 flex max-w-[70ch] list-decimal flex-col gap-2 marker:text-ink-subtle">
        <li>{t("Open the Discord server where you want notifications to land.")}</li>
        <li>
          {t("Right-click a text channel, pick")}{" "}
          <span className="text-ink">{t("Edit Channel")}</span>.
        </li>
        <li>
          {t("Click")} <span className="text-ink">{t("Integrations")}</span>{" "}
          {t("on the left, then")} <span className="text-ink">{t("Webhooks")}</span>.
        </li>
        <li>
          {t("Click")} <span className="text-ink">{t("New Webhook")}</span>,{" "}
          {t("name it Harbor, hit")} <span className="text-ink">{t("Copy Webhook URL")}</span>.
        </li>
        <li>{t("Paste the URL into the box above and send a test.")}</li>
      </ol>
      <p className="max-w-[70ch]">
        {t(
          "No Integrations option? You need the Manage Webhooks permission. Ask whoever owns the server.",
        )}
      </p>
      <ExternalLinkButton
        label={t("Open Discord's webhook help")}
        url="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
      />
    </>
  );
}

export function TelegramTutorial() {
  const t = useT();
  return (
    <>
      <p className="max-w-[70ch]">
        {t("Telegram sends through a bot you create. You need two things: a")}{" "}
        <span className="text-ink">{t("bot token")}</span> {t("and your")}{" "}
        <span className="text-ink">{t("chat ID")}</span>.{" "}
        {t("Both go in the boxes above. Harbor builds the URL for you.")}
      </p>
      <ol className="ms-5 flex max-w-[70ch] list-decimal flex-col gap-2 marker:text-ink-subtle">
        <li>
          {t("Tap")} <span className="text-ink">{t("Open BotFather")}</span>{" "}
          {t("below. In Telegram, send him")} <span className="font-mono text-ink">/newbot</span>.{" "}
          {t("Pick any name. Pick a username ending in")}{" "}
          <span className="font-mono text-ink">bot</span>.
        </li>
        <li>
          {t("BotFather replies with a token like")}{" "}
          <span className="font-mono text-ink">1234567890:AAExample...</span>.{" "}
          {t("Long string with a colon in it. Copy it. Paste it into the")}{" "}
          <span className="text-ink">{t("Bot token")}</span> {t("box above.")}
        </li>
        <li>
          {t(
            "Open the bot BotFather just made (he sends you a link). Send it any message so it's allowed to message you back.",
          )}
        </li>
        <li>
          {t("Tap")} <span className="text-ink">{t("Open userinfobot")}</span> {t("below. Send it")}{" "}
          <span className="font-mono text-ink">/start</span>.{" "}
          {t("It replies with your numeric ID. Copy that number. Paste it into the")}{" "}
          <span className="text-ink">{t("Chat ID")}</span> {t("box above.")}
        </li>
        <li>
          {t("Hit")} <span className="text-ink">{t("Send test")}</span>.{" "}
          {t("You should get a message from your new bot.")}
        </li>
      </ol>
      <div className="flex flex-wrap gap-2.5">
        <ExternalLinkButton label={t("Open BotFather")} url="https://t.me/botfather" />
        <ExternalLinkButton label={t("Open userinfobot")} url="https://t.me/userinfobot" />
      </div>
    </>
  );
}

export function DiscordMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0 text-ink"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export function TelegramMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0 text-ink"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function ExternalLinkButton({ label, url }: { label: string; url: string }) {
  const t = useT();
  return (
    <SButton onClick={() => openUrl(url)} className="self-start">
      {t(label)}
      <ExternalLink size={16} strokeWidth={2.2} />
    </SButton>
  );
}
