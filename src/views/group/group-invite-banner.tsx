import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { respondToInvite, type GroupDetail } from "@/lib/social/groups";

export function GroupInviteBanner({
  detail,
  onAccepted,
  onDeclined,
}: {
  detail: GroupDetail;
  onAccepted: (d: GroupDetail) => void;
  onDeclined: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (accept: boolean) => {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      const res = await respondToInvite(detail.id, accept);
      if (accept) onAccepted(res as GroupDetail);
      else onDeclined();
    } catch (e) {
      setError((e as Error).message || t("Could not respond to that invite."));
      setBusy(null);
    }
  };

  const inviter = detail.owner?.alias || detail.owner?.handle;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-elevated/70 p-4 ring-1 ring-accent/25">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold text-ink">
          {inviter
            ? t("{name} invited you to {group}", { name: inviter, group: detail.name })
            : t("You were invited to {group}", { group: detail.name })}
        </span>
        <span className="text-[12.5px] text-ink-subtle">
          {t("You are not a member yet. Accept to join and take part.")}
        </span>
        {error && <span className="text-[12.5px] text-danger">{error}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void respond(false)}
          disabled={!!busy}
          className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy === "decline" ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
          {t("Decline")}
        </button>
        <button
          type="button"
          onClick={() => void respond(true)}
          disabled={!!busy}
          className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "accept" ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} strokeWidth={2.6} />}
          {t("Accept")}
        </button>
      </div>
    </div>
  );
}
