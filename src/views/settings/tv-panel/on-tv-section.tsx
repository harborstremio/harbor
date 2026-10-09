import { useT } from "@/lib/i18n";
import { Section, useSettingsActiveContext } from "../shared";
import type { SectionId } from "../shared";
import { SettingRow } from "../kit";
import { SButton } from "../ui";

type Item = { title: string; detail: string; jump?: SectionId; jumpLabel?: string };

const ITEMS: Item[] = [
  {
    title: "Profiles",
    detail:
      "Who watches on the TV. The roster already syncs from your account, so add people here on the computer and they appear on the TV.",
  },
  {
    title: "Accounts and TMDB",
    detail:
      "Signing the TV in to Stremio, Trakt, AniList and the metadata keys. Scan the code with your phone from the TV itself.",
    jump: "account",
    jumpLabel: "Your accounts",
  },
  {
    title: "More ratings",
    detail:
      "Rotten Tomatoes, Metacritic, Letterboxd, Trakt and Simkl scores on the TV need an MDBList key entered on the TV.",
    jump: "library",
    jumpLabel: "Library and metadata",
  },
  {
    title: "Live TV playlists",
    detail: "An M3U link or Xtream Codes login. Entered on the TV so the credentials stay on it.",
  },
  {
    title: "Addons",
    detail:
      "Installing and ordering addons on the TV. Addon lists already travel with your account, so install here and the TV picks them up.",
    jump: "streaming",
    jumpLabel: "Streaming sources",
  },
  {
    title: "Watch together",
    detail: "Starting or joining a room. It has to happen on the device that is playing.",
    jump: "relay",
    jumpLabel: "Harbor Relay",
  },
  {
    title: "Other devices",
    detail:
      "The pairing code the TV shows so a phone or this computer can hand a title to it. It is generated on the TV.",
    jump: "remotes",
    jumpLabel: "Remotes",
  },
];

export function TvOnDeviceSection() {
  const t = useT();
  const { setActive } = useSettingsActiveContext();
  return (
    <Section
      title={t("Still done on the TV")}
      subtitle={t("These need the television in front of you, either because they show a pairing code or because the credential should never leave the device.")}
    >
      {ITEMS.map((item) => (
        <SettingRow key={item.title} label={t(item.title)} desc={t(item.detail)}>
          {item.jump && (
            <SButton onClick={() => setActive(item.jump as SectionId)}>
              {t(item.jumpLabel ?? "Open")}
            </SButton>
          )}
        </SettingRow>
      ))}
    </Section>
  );
}
