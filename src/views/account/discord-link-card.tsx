import { useState } from "react";
import { ExternalLink, Loader2 } from "@/views/settings/icons";
import { DiscordIcon } from "@/components/discord-icon";
import { linkDiscord, unlinkDiscord } from "@/lib/account/discord-link";
import { accountErrorMessage, type AccountErrorMessage } from "@/lib/account/error-messages";
import { canDiscordAuth } from "@/lib/discord-auth";
import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_DANGER, SettingRow } from "@/views/settings/kit";

export function DiscordLinkCard({
  author,
  onRecovery,
}: {
  author: Author;
  onRecovery?: (code: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountErrorMessage | null>(null);
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
      <div aria-busy={busy}>
        <SettingRow
          label={t("Discord linked")}
          desc={
            author.discordUsername
              ? t("Linked as {username}", { username: author.discordUsername })
              : t("Linked to your Harbor account.")
          }
          icon={<DiscordIcon size={24} className="text-[#5865F2]" />}
        >
          <button
            type="button"
            onClick={() => void unlink()}
            disabled={busy}
            className={ROW_ACTION_DANGER}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t("Unlink")}
          </button>
        </SettingRow>
        {error && (
          <p role="alert" className="pb-4 text-[15px] leading-[22px] text-danger">
            {error.kind === "built-in" ? t(error.key) : error.detail}
          </p>
        )}
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
    <div aria-busy={busy}>
      <SettingRow
        label={t("Link Discord")}
        desc={t("Also joins Harbor's Discord server.")}
        icon={<DiscordIcon size={24} className="text-[#5865F2]" />}
      >
        {canDesktop ? (
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className={ROW_ACTION}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("Continue in your browser...")}
              </>
            ) : (
              <>
                {t("Link Discord")}
                <ExternalLink size={16} />
              </>
            )}
          </button>
        ) : (
          <p className="max-w-[30ch] text-[15px] leading-[22px] text-ink-muted">
            {t("Open Harbor on desktop to link Discord.")}
          </p>
        )}
      </SettingRow>
      {error && (
        <p role="alert" className="pb-4 text-[15px] leading-[22px] text-danger">
          {error.kind === "built-in" ? t(error.key) : error.detail}
        </p>
      )}
    </div>
  );
}
