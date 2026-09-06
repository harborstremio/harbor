import harborDiscord from "@/assets/harbor-discord.svg";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, ToggleRow } from "../shared";
import { PrivacyRow } from "../privacy-row";
import { isTauri } from "../player-panel/internals";

export function PrivacyTab() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Privacy")}
        subtitle={t(
          "Choose whether to block requests to known advertising, analytics, and tracking services.",
        )}
      >
        <PrivacyRow />
      </Section>

      {isTauri && (
        <Section
          title={t("Discord Rich Presence")}
          subtitle={t(
            "Control what appears on your Discord profile while you use Harbor.",
          )}
        >
          <DiscordPresenceRow />
        </Section>
      )}
    </>
  );
}

function DiscordPresenceRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.discordRichPresence;
  return (
    <>
      <ToggleRow
        label={t("Show on Discord")}
        sub={t(
          "Display what you are watching on your Discord profile, with the show poster and a live progress bar. Requires the Discord desktop app to be running.",
        )}
        leading={
          <img
            src={harborDiscord}
            alt=""
            draggable={false}
            className="h-5 w-5 shrink-0 object-contain"
          />
        }
        value={on}
        onChange={(discordRichPresence) => update({ discordRichPresence })}
      />
      {on && (
        <>
          <ToggleRow
            label={t("Hide the title")}
            sub={t("Show 'Watching something' with no show name or poster.")}
            value={settings.discordHideTitle}
            onChange={(discordHideTitle) => update({ discordHideTitle })}
          />
          <ToggleRow
            label={t("Show while paused")}
            sub={t("Keep the presence visible when playback is paused.")}
            value={settings.discordShowWhenPaused}
            onChange={(discordShowWhenPaused) => update({ discordShowWhenPaused })}
          />
          <ToggleRow
            label={t("Show while browsing")}
            sub={t("Display 'Browsing Harbor' when nothing is playing.")}
            value={settings.discordShowWhenBrowsing}
            onChange={(discordShowWhenBrowsing) => update({ discordShowWhenBrowsing })}
          />
          {!settings.discordHideTitle && <ToggleRow
            label={t("Show poster")}
            sub={t("Reveal the show or movie artwork. Off keeps the title but hides the poster.")}
            value={settings.discordShowPoster}
            onChange={(discordShowPoster) => update({ discordShowPoster })}
          />}
          {!settings.discordHideTitle && <ToggleRow
            label={t("Show elapsed time")}
            sub={t("Display the live progress bar showing how far into the title you are.")}
            value={settings.discordShowTimestamp}
            onChange={(discordShowTimestamp) => update({ discordShowTimestamp })}
          />}
          <ToggleRow
            label={t("Watch party join button")}
            sub={t("Add a Join button with your room link while you're in a watch party.")}
            value={settings.discordShowPartyJoin}
            onChange={(discordShowPartyJoin) => update({ discordShowPartyJoin })}
          />
          <p className={`max-w-[70ch] ${ROW_DESC}`}>
            {t(
              "Activity from adult addons is never shown on Discord.",
            )}
          </p>
        </>
      )}
    </>
  );
}
