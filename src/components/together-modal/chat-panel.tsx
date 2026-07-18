import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/together/provider";
import type { Participant } from "@/lib/together/protocol";
import { useT } from "@/lib/i18n";
import { Avatar } from "./avatar";

export function ChatPanel({
  chat,
  participants,
  clientId,
  selfAvatar,
  selfColor,
  onSend,
}: {
  chat: ChatMessage[];
  participants: Participant[];
  clientId: string;
  selfAvatar: string | null;
  selfColor: string | null;
  onSend: (text: string) => void;
}) {
  const t = useT();
  const chatRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] uppercase tracking-wider text-ink-subtle">{t("Chat")}</span>
      <div
        ref={chatRef}
        className="flex h-36 flex-col gap-1.5 overflow-y-auto rounded-lg border border-edge bg-canvas/60 p-2.5"
      >
        {chat.length === 0 && (
          <p className="m-auto text-[11.5px] text-ink-subtle">{t("Say hi.")}</p>
        )}
        {chat.map((m, i) => {
          const self = m.from === clientId;
          const peer = participants.find((p) => p.id === m.from);
          const avatarSrc = self ? selfAvatar : (peer?.avatar ?? null);
          const color = self ? selfColor : (peer?.color ?? null);
          return (
            <div key={`${m.at}-${i}`} className="flex items-start gap-2">
              <Avatar name={m.name} src={avatarSrc} color={color} size={18} />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10.5px] font-medium" style={{ color: color ?? undefined }}>
                  {m.name}
                </span>
                <span className="text-[12.5px] leading-tight text-ink">{m.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("Message")}
          className="h-9 flex-1 rounded-lg border border-edge bg-canvas px-2.5 text-[12.5px] text-ink focus:border-accent"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-canvas transition-transform hover:scale-[1.05] disabled:opacity-40 disabled:hover:scale-100"
          aria-label={t("Send")}
        >
          <Send size={13} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
