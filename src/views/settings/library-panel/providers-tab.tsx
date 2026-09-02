import { ActionRow } from "../advanced-panel/action-row";
import { resetOmdbBudget, subscribeOmdbBudget, type OmdbBudget, omdbBudget as readOmdbBudget } from "@/lib/providers/omdb";
import { useEffect, useState } from "react";
import { Music, Check, RotateCw } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { hasCustomMetaAddon } from "@/lib/meta-resource";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingGroup, SettingRow, Nested } from "../kit";
import { EpisodeOrderSetting } from "../episode-order-setting";
import { useProviderKeys, type ProviderKeysArgs } from "./provider-keys";

export function ProvidersTab(props: ProviderKeysArgs) {
  const { settings, update } = useSettings();
  const hasMetaAddon = hasCustomMetaAddon();
  const t = useT();
  const { keyRow, modals } = useProviderKeys(props);

  return (
    <>
      {modals}

      <Section title={t("Metadata providers")}>
        <SettingGroup>
          <SettingRow
            wide
            label={t("Bring your own keys")}
            desc={t(
              "A free TMDB key is highly recommended. It unlocks the full Harbor experience. The rest are optional, and Cinemeta works out of the box without any.",
            )}
          />
          {keyRow("tmdb")}
          {keyRow("omdb")}
          {keyRow("tvdb")}
          {keyRow("mdblist")}
          {keyRow("fanart")}
          {keyRow("rpdb")}
          {keyRow("postersrv")}
          {keyRow("nyt")}
        </SettingGroup>
      </Section>

      <Section title={t("Titles and descriptions")}>
        <SettingGroup>
          <ToggleRow
            label={t("Use Cinemeta for title metadata")}
            sub={t(
              "Only turn this off if you already have a metadata addon installed, such as AIOMetadata or AIOStreams. Without one, titles and collections can open completely blank. Cinemeta can go stale and show released episodes as TBA, which is the reason to replace it.",
            )}
            value={settings.cinemetaEnabled}
            onChange={(v) => update({ cinemetaEnabled: v })}
            warn={
              !settings.cinemetaEnabled && !hasMetaAddon
                ? t(
                    "No metadata addon detected. Harbor is falling back to Cinemeta so titles still load, but turn this back on unless you are installing one.",
                  )
                : undefined
            }
          />
          <ToggleRow
            label={t("Prefer my installed metadata addon")}
            sub={t(
              "Use a custom meta addon you installed (e.g. a localized Cinemeta) for titles and descriptions instead of the built-in Cinemeta. Falls back to Cinemeta if yours has no data.",
            )}
            value={settings.preferCustomMetaAddon}
            onChange={(v) => update({ preferCustomMetaAddon: v })}
          />
          <ToggleRow
            label={t("Use free IMDb data without a TMDB key")}
            sub={t(
              "With no TMDB key, the About panel pulls cast, crew, and title info from a free IMDb source. TMDB is still used whenever a key is set.",
            )}
            value={settings.imdbApiFallback}
            onChange={(v) => update({ imdbApiFallback: v })}
          />
        </SettingGroup>
      </Section>

      <Section title={t("Episode order")}>
        <SettingGroup>
          <EpisodeOrderSetting />
        </SettingGroup>
      </Section>

      <Section title={t("Song identification")}>
        <SettingGroup>
          <SettingRow
            icon={<Music size={16} />}
            label={t("Song ID provider")}
            desc={t("Which service names the track when you tap Identify song in the player.")}
          >
            <Segmented
              value={settings.songIdProvider}
              options={[
                { value: "audd", label: t("AudD") },
                { value: "ai", label: t("AI (Gemini)") },
              ]}
              onChange={(v) => update({ songIdProvider: v as "audd" | "ai" })}
            />
          </SettingRow>
          <Nested>{settings.songIdProvider === "ai" ? keyRow("songai") : keyRow("audd")}</Nested>
        </SettingGroup>
      </Section>

      <Section title={t("API budget")}>
        <SettingGroup>
          <OmdbBudgetRow />
        </SettingGroup>
      </Section>
    </>
  );
}

function OmdbBudgetRow() {
  const tr = useT();
  const { settings } = useSettings();
  const [budget, setBudget] = useState<OmdbBudget>(() => readOmdbBudget());
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => subscribeOmdbBudget(setBudget), []);
  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(() => setConfirmed(false), 1400);
    return () => clearTimeout(t);
  }, [confirmed]);

  if (!settings.omdbKey) {
    return (
      <ActionRow
        label={tr("OMDB daily budget")}
        sub={tr("Save an OMDB key in Library & metadata to enable rating fetches.")}
        disabled
      />
    );
  }

  const sub = budget.keyInvalid
    ? tr("Key rejected. Check it on Library & metadata.")
    : tr("{used} / {limit} requests today.", { used: budget.used, limit: budget.limit }) +
      (budget.exhausted ? " " + tr("Budget exhausted, resets at midnight UTC.") : "");

  return (
    <ActionRow
      label={tr("OMDB daily budget")}
      sub={sub}
      cta={confirmed ? tr("Reset") : tr("Reset counter")}
      icon={confirmed ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />}
      tone={confirmed ? "success" : "neutral"}
      onClick={() => {
        resetOmdbBudget();
        setConfirmed(true);
      }}
    />
  );
}
