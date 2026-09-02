import harborDiscord from "@/assets/harbor-discord.svg";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";
import { SettingGroup } from "../kit";
import { PrivacyRow } from "../privacy-row";
import { isTauri } from "../player-panel/internals";

export function PrivacyTab() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Privacy")}
        subtitle={t(
          "Harbor sends no telemetry. This also drops outbound ad, analytics, and tracker requests that addons or metadata providers try to make, before they leave your machine.",
        )}
      >
        <PrivacyRow />
      </Section>

      {isTauri && (
        <Section
          title={t("Discord Rich Presence")}
          subtitle={t(
            "Let your Discord friends see what you are watching, with the show poster and a live progress bar. Desktop only, and only your own Discord client is involved (nothing touches a Harbor server).",
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
    <SettingGroup>
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
            className="h-9 w-auto shrink-0 object-contain"
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
          <ToggleRow
            label={t("Show poster")}
            sub={t("Reveal the show or movie artwork. Off keeps the title but hides the poster.")}
            value={settings.discordShowPoster}
            onChange={(discordShowPoster) => update({ discordShowPoster })}
          />
          <ToggleRow
            label={t("Show elapsed time")}
            sub={t("Display the live progress bar showing how far into the title you are.")}
            value={settings.discordShowTimestamp}
            onChange={(discordShowTimestamp) => update({ discordShowTimestamp })}
          />
          <ToggleRow
            label={t("Watch party join button")}
            sub={t("Add a Join button with your room link while you're in a watch party.")}
            value={settings.discordShowPartyJoin}
            onChange={(discordShowPartyJoin) => update({ discordShowPartyJoin })}
          />
          <p className="px-1 pt-1 text-[11.5px] leading-snug text-ink-subtle">
            {t(
              "And for the naughty ones: browsing or rating an adult addon never shows on Discord.",
            )}
          </p>
        </>
      )}
    </SettingGroup>
  );
}
