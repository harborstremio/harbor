import { useCallback, useEffect, useRef, useState } from "react";
import { useTogether, type ChatMessage } from "@/lib/together/provider";
import { useView } from "@/lib/view";

const VISIBLE_MS = 5500;
const MAX_TOASTS = 3;

export function TogetherChatToast() {
  const { chat, modalOpen, clientId, snapshot } = useTogether();
  const { player } = useView();
  const seenAtRef = useRef<number>(Date.now());
  const [toasts, setToasts] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (chat.length === 0) return;
    const latest = chat[chat.length - 1];
    if (latest.at <= seenAtRef.current) return;
    seenAtRef.current = latest.at;
    if (modalOpen || player) return;
    if (latest.from === clientId) return;
    setToasts((cur) => [...cur, latest].slice(-MAX_TOASTS));
  }, [chat, modalOpen, clientId, player]);

  useEffect(() => {
    if (modalOpen || player) setToasts([]);
  }, [modalOpen, player]);

  const expire = useCallback((id: string) => {
    setToasts((cur) => cur.filter((m) => `${m.from}-${m.at}` !== id));
  }, []);

  if (player) return null;
  if (snapshot.state !== "joined") return null;
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed end-6 top-24 z-[55] flex max-w-[320px] flex-col items-end gap-2">
      {toasts.map((m) => {
        const peer = snapshot.participants.find((p) => p.id === m.from);
        return (
          <ChatBubble
            key={`${m.from}-${m.at}`}
            msg={m}
            avatar={peer?.avatar ?? null}
            color={peer?.color ?? null}
            onExpire={expire}
          />
        );
      })}
    </div>
  );
}

function ChatBubble({
  msg,
  avatar,
  color,
  onExpire,
}: {
  msg: ChatMessage;
  avatar: string | null;
  color: string | null;
  onExpire: (id: string) => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    const id = `${msg.from}-${msg.at}`;
    const t = window.setTimeout(() => onExpire(id), VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [msg.at, msg.from, onExpire]);

  const initial = msg.name.trim()[0]?.toUpperCase() ?? "?";
  const fallbackColor = color ?? `oklch(0.78 0.13 ${nameHue(msg.name)})`;

  return (
    <div className="harbor-chat-toast animate-slide-from-right rtl:animate-slide-from-left pointer-events-auto flex w-full max-w-[320px] items-start gap-2.5 rounded-xl border border-edge-soft/70 bg-elevated/80 px-3.5 py-2.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-sm">
      {avatar && !avatarFailed ? (
        <img
          src={avatar}
          alt=""
          aria-hidden
          draggable={false}
          onError={() => setAvatarFailed(true)}
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-canvas"
          style={{ backgroundColor: fallbackColor }}
        >
          {initial}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-medium" style={{ color: color ?? undefined }}>
          {msg.name}
        </span>
        <p className="break-words text-[12.5px] leading-snug text-ink">{msg.text}</p>
      </div>
    </div>
  );
}

function nameHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
