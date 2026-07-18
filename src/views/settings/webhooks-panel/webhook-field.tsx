import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { openUrl } from "@/lib/window";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export type FieldStatus = { state: "idle" | "busy" | "ok" | "error"; message: string | null };

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
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          {logo}
          {label}
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="h-10 flex-1 rounded-lg border border-edge bg-canvas px-3 font-mono text-[12px] text-ink outline-none transition-colors focus:border-ink-subtle"
        />
        <button
          onClick={onTest}
          disabled={!value || status.state === "busy"}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status.state === "busy" && (
            <Loader2 size={12} strokeWidth={2.4} className="animate-spin" />
          )}
          {t("Send test")}
        </button>
      </div>
      <div className="rounded-lg bg-canvas/60 p-3 text-[12px] leading-relaxed text-ink-muted">
        {help}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: FieldStatus }) {
  const t = useT();
  if (status.state === "idle") return null;
  const palette =
    status.state === "ok"
      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
      : status.state === "error"
        ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
        : "border-edge bg-elevated/40 text-ink-muted";
  return (
    <span
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${palette}`}
    >
      {status.state === "ok" && <Check size={11} strokeWidth={2.6} />}
      {status.state === "error" && <X size={11} strokeWidth={2.6} />}
      {status.state === "busy" && <Loader2 size={11} strokeWidth={2.4} className="animate-spin" />}
      {status.message ? t(status.message) : null}
    </span>
  );
}

export function DiscordTutorial() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] text-ink-muted">
        {t(
          "Discord posts a message to a channel whenever Harbor pings it. Takes about a minute to set up.",
        )}
      </p>
      <ol className="ms-4 list-decimal space-y-1.5 text-[12px] text-ink-muted marker:text-ink-subtle">
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
      <p className="text-[11.5px] text-ink-subtle">
        {t(
          "No Integrations option? You need the Manage Webhooks permission. Ask whoever owns the server.",
        )}
      </p>
      <ExternalLinkButton
        label={t("Open Discord's webhook help")}
        url="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
      />
    </div>
  );
}

export function TelegramTutorial() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] text-ink-muted">
        {t("Telegram sends through a bot you create. You need two things: a")}{" "}
        <span className="text-ink">{t("bot token")}</span> {t("and your")}{" "}
        <span className="text-ink">{t("chat ID")}</span>.{" "}
        {t("Both go in the boxes above. Harbor builds the URL for you.")}
      </p>
      <ol className="ms-4 list-decimal space-y-1.5 text-[12px] text-ink-muted marker:text-ink-subtle">
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
      <div className="flex flex-wrap gap-2">
        <ExternalLinkButton label={t("Open BotFather")} url="https://t.me/botfather" />
        <ExternalLinkButton label={t("Open userinfobot")} url="https://t.me/userinfobot" />
      </div>
    </div>
  );
}

export function DiscordMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#5865F2"
      aria-hidden
      className="shrink-0"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export function TelegramMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#29A9EB"
      aria-hidden
      className="shrink-0"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function ExternalLinkButton({ label, url }: { label: string; url: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => openUrl(url)}
      className="inline-flex items-center gap-1.5 self-start rounded-lg border border-edge-soft bg-canvas/60 px-3 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-edge hover:bg-canvas/80"
    >
      {t(label)}
      <ExternalLink size={11} strokeWidth={2.2} />
    </button>
  );
}
