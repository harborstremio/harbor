import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  readTheIntroDbKey,
  setTheIntroDbApiKey,
  theIntroDbKeyPatch,
} from "@/lib/skip-intro/theintrodb";
import { SettingRow } from "../kit";
import { ExtLink, KeyField, Section, Segmented, ToggleRow } from "../shared";
import introdbLogo from "@/assets/service-logos/theintrodb.png";

export function IntrosTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const storedKey = readTheIntroDbKey(settings);
  const [keyDraft, setKeyDraft] = useState(storedKey);
  const [keySaved, setKeySaved] = useState(false);
  const savedTimerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(savedTimerRef.current), []);

  const saveKey = (value: string) => {
    const next = value.trim();
    update(theIntroDbKeyPatch(next));
    setTheIntroDbApiKey(next);
    setKeyDraft(next);
    setKeySaved(true);
    window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setKeySaved(false), 1800);
  };

  return (
    <Section
      title={t("Skip intros & credits")}
      subtitle={t("Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.")}
    >
      <ToggleRow
        label={t("Show the Skip button")}
        sub={t("Show a Skip Intro / Skip Credits button when Harbor detects one. Turn this off to never show it. You can also tap the X on the button to dismiss a wrong one for the rest of the episode.")}
        value={settings.showSkipButton}
        onChange={(v) => update({ showSkipButton: v })}
      />
      <ToggleRow
        label={t("Auto-skip intros")}
        sub={t("Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.")}
        value={settings.autoSkipIntro}
        onChange={(v) => update({ autoSkipIntro: v })}
      />
      <ToggleRow
        label={t("Auto-skip recaps")}
        sub={t("Automatically jump past recap segments.")}
        value={settings.autoSkipRecap}
        onChange={(v) => update({ autoSkipRecap: v })}
      />
      <ToggleRow
        label={t("Auto-skip credit outros")}
        sub={t("Automatically skip ending credits and trigger the next episode countdown immediately.")}
        value={settings.autoSkipOutro}
        onChange={(v) => update({ autoSkipOutro: v })}
      />
      {settings.showSkipButton && (
        <SettingRow
          wide
          label={t("Auto-hide the Skip button after")}
          desc={t("Hides the button on its own after a few seconds so a wrong one doesn't sit there the whole episode.")}
        >
          <Segmented
            value={String(settings.skipButtonHideSec)}
            options={[
              { value: "0", label: t("Off") },
              { value: "5", label: t("5s") },
              { value: "10", label: t("10s") },
              { value: "15", label: t("15s") },
              { value: "30", label: t("30s") },
            ]}
            onChange={(v) => update({ skipButtonHideSec: Number(v) })}
          />
        </SettingRow>
      )}
      <KeyField
        label={t("TheIntroDB · intro and credits timing")}
        iconSrc={introdbLogo}
        placeholder={t("Paste your TheIntroDB API key")}
        value={keyDraft}
        onChange={setKeyDraft}
        onSave={() => saveKey(keyDraft)}
        saved={keySaved}
        help={
          <>
            {t(
              "Optional. TheIntroDB answers without a key, but a key raises your rate limit so timing keeps arriving when you binge. Get one at",
            )}{" "}
            <ExtLink href="https://theintrodb.org">theintrodb.org</ExtLink>.
          </>
        }
      />
    </Section>
  );
}
