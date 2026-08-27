import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { DiscordIcon } from "@/components/discord-icon";
import { linkDiscord, unlinkDiscord } from "@/lib/account/discord-link";
import { accountErrorMessage } from "@/lib/account/error-messages";
import { canDiscordAuth } from "@/lib/discord-auth";
import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";

export function DiscordLinkCard({
  author,
  onRecovery,
}: {
  author: Author;
  onRecovery?: (code: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDesktop = canDiscordAuth();

  if (author.discordLinkMethod) {
    const unlink = async () => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const { recoveryCode } = await unlinkDiscord();
        // Unlinking rotates the recovery code (see discord/unlink on the
        // backend): the old one was delivered via a Discord DM that outlives
        // this unlink, so it must not stay valid. Show the replacement the
        // same way a fresh signup does.
        if (recoveryCode) onRecovery?.(recoveryCode);
      } catch (e) {
        setError(accountErrorMessage(e));
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#5865F2]/15 text-[#5865F2]">
            <DiscordIcon size={18} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold text-ink">{t("Discord linked")}</span>
            <span className="truncate text-[12px] text-ink-subtle">
              {author.discordUsername
                ? t("Linked as {username}", { username: author.discordUsername })
                : t("Linked to your Harbor account.")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void unlink()}
            disabled={busy}
            className="ms-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-danger/40 px-3 text-[12px] font-medium text-danger transition-colors duration-150 hover:border-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {t("Unlink")}
          </button>
        </div>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    );
  }

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await linkDiscord();
    } catch (e) {
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#5865F2]/15 text-[#5865F2]">
          <DiscordIcon size={18} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-ink">{t("Link Discord")}</span>
          <span className="truncate text-[12px] text-ink-subtle">
            {t("Also joins Harbor's Discord server.")}
          </span>
        </div>
      </div>

      {canDesktop ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13.5px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t("Continue in your browser...")}
            </>
          ) : (
            <>
              <DiscordIcon size={16} />
              {t("Link Discord")}
              <ExternalLink size={14} />
            </>
          )}
        </button>
      ) : (
        <p className="rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-3 text-[12px] text-ink-subtle">
          {t("Open Harbor on desktop to link Discord.")}
        </p>
      )}

      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
