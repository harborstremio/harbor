import { Loader2 } from "../icons";
import { useEffect, useState } from "react";
import {
  FIELD_HELP,
  FIELD_LABEL,
  StatusBadge,
  TelegramMark,
  TelegramTutorial,
  type FieldStatus,
} from "./webhook-field";
import { ROW_ACTION_PRIMARY } from "../kit";
import { useT } from "@/lib/i18n";

const URL_RE = /^https?:\/\/api\.telegram\.org\/bot([^/]+)\/sendMessage(?:\?chat_id=(.+))?$/;

const SUB_INPUT =
  "h-11 w-full min-w-0 max-w-[520px] rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] tracking-wide text-ink outline-none transition-colors placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function compose(token: string, chatId: string): string {
  const t = token.trim();
  const c = chatId.trim();
  if (!t || !c) return "";
  return `https://api.telegram.org/bot${t}/sendMessage?chat_id=${c}`;
}

function parse(url: string): { token: string; chatId: string } {
  const m = url.match(URL_RE);
  return { token: m?.[1] ?? "", chatId: m?.[2] ?? "" };
}

export function TelegramComposedField({
  fullUrl,
  onUrlChange,
  onTest,
  status,
}: {
  fullUrl: string;
  onUrlChange: (url: string) => void;
  onTest: () => void;
  status: FieldStatus;
}) {
  const t = useT();
  const [token, setToken] = useState(() => parse(fullUrl).token);
  const [chatId, setChatId] = useState(() => parse(fullUrl).chatId);

  useEffect(() => {
    const next = parse(fullUrl);
    setToken((prev) => (prev === next.token ? prev : next.token));
    setChatId((prev) => (prev === next.chatId ? prev : next.chatId));
  }, [fullUrl]);

  const onTokenChange = (raw: string) => {
    const v = raw.trim();
    const m = v.match(URL_RE);
    if (m) {
      const t = m[1];
      const c = m[2] ?? chatId;
      setToken(t);
      if (m[2]) setChatId(m[2]);
      onUrlChange(compose(t, c));
      return;
    }
    setToken(v);
    onUrlChange(compose(v, chatId));
  };

  const onChatIdChange = (raw: string) => {
    const v = raw.trim();
    setChatId(v);
    onUrlChange(compose(token, v));
  };

  const ready = token.length > 0 && chatId.length > 0;
  const busy = status.state === "busy";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <TelegramMark />
          <span className={FIELD_LABEL}>{t("Telegram bot")}</span>
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-col gap-3">
        <SubField
          label={t("Bot token")}
          placeholder="1234567890:AAExampleTokenFromBotFather"
          value={token}
          onChange={onTokenChange}
        />
        <SubField
          label={t("Chat ID")}
          placeholder="123456789"
          value={chatId}
          onChange={onChatIdChange}
        />
      </div>
      <button
        type="button"
        onClick={busy ? undefined : onTest}
        aria-disabled={busy}
        disabled={!ready}
        className={`${ROW_ACTION_PRIMARY} self-start${busy ? " pointer-events-none opacity-40" : ""}`}
      >
        {busy && <Loader2 size={17} strokeWidth={2.4} className="shrink-0 animate-spin" />}
        {t("Send test")}
      </button>
      <div className={FIELD_HELP}>
        <TelegramTutorial />
      </div>
    </div>
  );
}

function SubField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className={FIELD_LABEL}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={SUB_INPUT}
      />
    </label>
  );
}
