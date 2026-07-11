import { useT } from "@/lib/i18n";
import type { PanelCorner } from "@/lib/player-chrome";
import { nameColor } from "@/lib/together/colors";
import type { Participant } from "@/lib/together/protocol";
import type { ChatMessage } from "@/lib/together/provider";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const RECENT_WINDOW_MS = 7000;
const COMPOSE_TIMEOUT_MS = 4500;
const GROUP_GAP_MS = 90_000;

const CORNER_POSITION: Record<PanelCorner, string> = {
  "top-left": "top-20 left-6 items-start",
  "top-right": "top-20 right-6 items-end",
  "bottom-left": "bottom-44 left-6 items-start",
  "bottom-right": "bottom-44 right-6 items-end",
};

export function ChatOverlay({
  messages,
  onSend,
  selfId,
  participants,
  forceVisible,
  corner = "bottom-left",
  hidden = false,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  selfId: string;
  participants: Participant[];
  forceVisible: boolean;
  corner?: PanelCorner;
  hidden?: boolean;
}) {
  const t = useT();
  const selfIdentity = useSelfIdentity();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [tickNow, setTickNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const composeTimer = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key ?? "").toLowerCase() === "t" && !composing && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setComposing(true);
        setTimeout(() => inputRef.current?.focus(), 30);
      }
      if (e.key === "Escape" && composing) {
        setComposing(false);
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing]);

  useEffect(() => {
    if (!composing) return;
    if (composeTimer.current) window.clearTimeout(composeTimer.current);
    composeTimer.current = window.setTimeout(() => {
      if (!draft.trim()) {
        setComposing(false);
        setDraft("");
      }
    }, COMPOSE_TIMEOUT_MS);
    return () => {
      if (composeTimer.current) window.clearTimeout(composeTimer.current);
    };
  }, [composing, draft]);

  const recent = useMemo(
    () => messages.filter((m) => tickNow - m.at < RECENT_WINDOW_MS).slice(-6),
    [messages, tickNow],
  );
  const grouped = useMemo(
    () =>
      recent.map((m, i) => {
        const prev = recent[i - 1];
        const isContinuation = !!prev && prev.from === m.from && m.at - prev.at < GROUP_GAP_MS;
        return { message: m, isContinuation };
      }),
    [recent],
  );
  const showStream = recent.length > 0 || forceVisible || composing;

  const submit = () => {
    const txt = draft.trim();
    if (!txt) return;
    onSend(txt);
    setDraft("");
    setComposing(false);
  };

  if (hidden) return null;
  return (
    <div
      className={`pointer-events-none fixed ${CORNER_POSITION[corner]} z-30 flex max-w-[420px] flex-col transition-opacity duration-500 ${
        showStream ? "opacity-100" : "opacity-0"
      }`}
    >
      {grouped.map(({ message, isContinuation }) => {
        const isSelf = message.from === selfId;
        const ident = isSelf ? selfIdentity : participants.find((p) => p.id === message.from);
        return (
          <Bubble
            key={`${message.from}-${message.at}`}
            message={message}
            isSelf={isSelf}
            isContinuation={isContinuation}
            avatar={ident?.avatar ?? null}
            color={ident?.color ?? null}
          />
        );
      })}
      {composing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="pointer-events-auto mt-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3.5 py-2 backdrop-blur-xl shadow-[0_18px_45px_-20px_rgba(0,0,0,0.7)]"
        >
          <MessageCircle size={14} strokeWidth={2.2} className="text-white/55" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("Say something…")}
            className="flex-1 bg-transparent text-[13.5px] text-white placeholder:text-white/35 outline-none"
            maxLength={300}
          />
          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20"
            aria-label={t("Send")}
          >
            <Send size={12} strokeWidth={2.4} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => {
            setComposing(true);
            setTimeout(() => inputRef.current?.focus(), 30);
          }}
          className="pointer-events-auto mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-white/65 backdrop-blur-md transition-colors hover:bg-black/65 hover:text-white"
        >
          <MessageCircle size={11} strokeWidth={2.4} />
          {t("Press T")}
        </button>
      )}
    </div>
  );
}

function Bubble({
  message,
  isSelf,
  isContinuation,
  avatar,
  color,
}: {
  message: ChatMessage;
  isSelf: boolean;
  isContinuation: boolean;
  avatar: string | null;
  color: string | null;
}) {
  const tint = color ?? nameColor(message.name);
  if (isContinuation) {
    return (
      <div
        className={`pointer-events-auto flex max-w-full ${isSelf ? "self-end" : ""}`}
        style={{ marginTop: 2, paddingInlineStart: isSelf ? 0 : 32 }}
      >
        <span className="break-words rounded-2xl border border-white/10 bg-black/55 px-3 py-1.5 text-[13.5px] leading-snug text-white backdrop-blur-xl">
          {message.text}
        </span>
      </div>
    );
  }
  return (
    <div
      className={`pointer-events-auto mt-1.5 flex max-w-full items-start gap-2 rounded-2xl border border-white/10 bg-black/55 px-3 py-1.5 backdrop-blur-xl ${
        isSelf ? "self-end" : ""
      }`}
    >
      {avatar ? (
        <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15">
          <img src={avatar} alt="" draggable={false} className="h-full w-full object-cover" />
        </span>
      ) : (
        <span
          className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-black"
          style={{ background: tint }}
        >
          {(message.name?.[0] ?? "?").toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">{message.name}</span>
        <span className="break-words text-[13.5px] leading-snug text-white">{message.text}</span>
      </div>
    </div>
  );
}
