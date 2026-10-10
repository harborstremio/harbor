import { DiscordIcon } from "@/components/discord-icon";
import { HARBOR_DISCORD_INVITE } from "@/lib/config/endpoints";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { SettingRow } from "@/views/settings/kit";
import { SButton } from "@/views/settings/ui";

export function JoinDiscordCard() {
  const t = useT();
  return (
    <SettingRow
      label={t("Harbor on Discord")}
      desc={t("Release notes, help from other people using Harbor, and somewhere to send bugs.")}
      icon={<DiscordIcon className="h-[18px] w-[18px]" />}
    >
      <SButton onClick={() => void openUrl(HARBOR_DISCORD_INVITE)}>{t("Join")}</SButton>
    </SettingRow>
  );
}
