import { useT } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge, TelegramMark, TelegramTutorial, type FieldStatus } from "./webhook-field";

const URL_RE = /^https?:\/\/api\.telegram\.org\/bot([^/]+)\/sendMessage(?:\?chat_id=(.+))?$/;

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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <TelegramMark />
          {t("Telegram bot")}
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-col gap-2">
        <SubField
          label={t("Bot token")}
          placeholder="1234567890:AAExampleTokenFromBotFather"
          value={token}
          onChange={onTokenChange}
          monospace
        />
        <SubField label={t("Chat ID")} placeholder="123456789" value={chatId} onChange={onChatIdChange} monospace />
      </div>
      <button
        onClick={onTest}
        disabled={!ready || status.state === "busy"}
        className="flex h-10 items-center justify-center gap-1.5 self-start rounded-lg bg-ink px-5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status.state === "busy" && <Loader2 size={12} strokeWidth={2.4} className="animate-spin" />}
        {t("Send test")}
      </button>
      <div className="rounded-lg bg-canvas/60 p-3 text-[12px] leading-relaxed text-ink-muted">
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
  monospace,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  monospace?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={`h-10 rounded-lg border border-edge bg-canvas px-3 text-[12.5px] text-ink outline-none transition-colors focus:border-ink-subtle ${
          monospace ? "font-mono text-[12px]" : ""
        }`}
      />
    </label>
  );
}
