import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { buildInviteUrl } from "@/lib/together/invite";
import { useT } from "@/lib/i18n";
import { LinkGlyph } from "./link-glyph";

export function InvitePanel({
  relayUrl,
  room,
  onClose,
}: {
  relayUrl: string;
  room: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const inviteUrl = useMemo(() => {
    if (!relayUrl || !room) return "";
    return buildInviteUrl(relayUrl, room);
  }, [relayUrl, room]);

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  if (!room) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-edge bg-canvas/60 p-3.5">
        <p className="text-[13px] text-ink">{t("Start a room first.")}</p>
        <p className="text-[12px] leading-snug text-ink-muted">
          {t(
            "Once you're in a room you can copy a link that joins anyone instantly: it sets the relay URL and the room code in one click.",
          )}
        </p>
        <button
          onClick={onClose}
          className="self-start text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t("Back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-canvas/60 p-3.5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-ink-subtle">
          {t("Invite link")}
        </span>
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 rounded-lg border border-edge bg-canvas px-3 font-mono text-[11.5px] text-ink outline-none"
        />
      </div>
      <button
        onClick={copy}
        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.01]"
      >
        {copied ? (
          <>
            <Check size={14} strokeWidth={2.4} />
            {t("Link copied")}
          </>
        ) : (
          <>
            <LinkGlyph />
            {t("Copy invite link")}
          </>
        )}
      </button>
      <p className="text-[11.5px] leading-snug text-ink-subtle">
        {t(
          "Anyone who opens this link gets the relay URL and room code set automatically. Works in the browser too: no install required for the joiner.",
        )}
      </p>
    </div>
  );
}
