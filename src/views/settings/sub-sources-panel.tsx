import { useEffect, useRef, useState, type ReactNode } from "react";
import { Blocks, ChevronRight, Languages, Puzzle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ExtLink, KeyField, Section, ToggleRow, useSettingsActiveContext } from "./shared";
import { Nested, SettingGroup } from "./kit";
import { SRow } from "./ui";
import openSubtitlesLogo from "@/assets/opensubtitles.png";
import opensubtitlesLogo from "@/assets/opensubtitles.png";
import wyzieLogo from "@/assets/wyzie.png";
import subdlLogo from "@/assets/service-logos/subdl.png";
import subsourceLogo from "@/assets/service-logos/subsource.png";

const LEAD_IMG = "h-[22px] w-[22px] shrink-0 object-contain";

type ProvKey = "opensubtitles" | "wyzie" | "addons" | "subdl" | "subsource";

function NavChevron() {
  return <ChevronRight size={18} className="shrink-0 text-ink-subtle rtl:-scale-x-100" />;
}

function SourceKeyField({
  label,
  placeholder,
  value,
  onCommit,
  help,
  iconSrc,
}: {
  label: string;
  placeholder: string;
  value: string;
  onCommit: (v: string) => void;
  help: ReactNode;
  iconSrc?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <KeyField
      label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(v) => {
        setDraft(v);
        setSaved(false);
      }}
      onSave={() => {
        onCommit(draft.trim());
        setSaved(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setSaved(false), 1600);
      }}
      saved={saved}
      help={help}
      iconSrc={iconSrc}
    />
  );
}

export function SubSourcesPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const { authKey } = useAuth();
  const { setActive } = useSettingsActiveContext();
  const [addons, setAddons] = useState<Addon[] | null>(null);

  const enabled = settings.subProvidersEnabled ?? {};
  const osOn = enabled.opensubtitles ?? true;
  const wyzieOn = enabled.wyzie ?? false;
  const addonsOn = enabled.addons ?? true;
  const subdlOn = enabled.subdl === true;
  const subsourceOn = enabled.subsource === true;

  useEffect(() => {
    let cancelled = false;
    gatherSubtitleAddons(authKey)
      .then((a) => {
        if (!cancelled) setAddons(a);
      })
      .catch(() => {
        if (!cancelled) setAddons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  const setProv = (key: ProvKey, v: boolean) =>
    update({ subProvidersEnabled: { ...enabled, [key]: v } });

  const subdlKey = (settings.subdlApiKey ?? "").trim();
  const subsourceKey = (settings.subsourceApiKey ?? "").trim();

  const addonCount = addons?.length ?? null;
  const addonSub =
    addonCount === null
      ? t("Any Stremio subtitle addons you have installed are searched here too.")
      : addonCount > 0
        ? t("{count} installed. Their results are merged in with everything else.", {
            count: addonCount,
          })
        : t("No subtitle addons installed yet.");
  const addonNames =
    addons && addons.length > 0
      ? addons.map((a) => a.manifest.name?.trim() || a.transportUrl).join(" · ")
      : undefined;

  return (
    <>
      <Section
        title={t("Subtitle sources")}
        subtitle={t("Harbor searches every source you enable at the same time, then merges and de-duplicates the results into one clean list. Turn a source off to stop pulling from it.")}
      >
        <SettingGroup label={t("Built into Harbor")}>
          <ToggleRow
            label={t("OpenSubtitles")}
            sub={t("Harbor's built-in OpenSubtitles search, on by default. If you install an OpenSubtitles addon, this steps aside automatically so your results are never duplicated.")}
            value={osOn}
            onChange={(v) => setProv("opensubtitles", v)}
            leading={<img src={opensubtitlesLogo} alt="" draggable={false} className={LEAD_IMG} />}
          />
          {osOn && (
            <Nested>
              <SourceKeyField
                label={t("OpenSubtitles API key")}
                iconSrc={openSubtitlesLogo}
                placeholder={t("Paste your OpenSubtitles API key")}
                value={settings.opensubtitlesApiKey ?? ""}
                onCommit={(v) => update({ opensubtitlesApiKey: v })}
                help={
                  <>
                    {t("Searching works without a key. Adding one lets Harbor line subtitles up with the audio on its own.")}{" "}
                    <ExtLink href="https://www.opensubtitles.com/consumers">
                      {t("Get a free key at opensubtitles.com")}
                    </ExtLink>
                  </>
                }
              />
            </Nested>
          )}
          <ToggleRow
            label={t("Wyzie")}
            sub={t("A fast community subtitle index. Off by default; turn it on for extra coverage on newer or niche releases.")}
            value={wyzieOn}
            onChange={(v) => setProv("wyzie", v)}
            leading={<img src={wyzieLogo} alt="" draggable={false} className={LEAD_IMG} />}
          />
        </SettingGroup>

        <SettingGroup label={t("From your addons")}>
          <ToggleRow
            label={t("Subtitle addons")}
            sub={addonSub}
            value={addonsOn}
            onChange={(v) => setProv("addons", v)}
            leading={<Puzzle size={20} strokeWidth={2} />}
          />
          <Nested>
            <SRow
              leading={<Blocks size={20} strokeWidth={2} />}
              title={t("Installed addons")}
              description={
                addonNames ??
                t("None yet. This opens Streaming sources, where subtitle addons are installed.")
              }
              trailing={<NavChevron />}
              onClick={() => setActive("streaming")}
            />
          </Nested>
        </SettingGroup>

        <SettingGroup label={t("Needs an API key")}>
          <ToggleRow
            label={t("SUBDL")}
            sub={t("A large multi-language subtitle database. Off until you add your free SUBDL API key.")}
            value={subdlOn}
            onChange={(v) => setProv("subdl", v)}
            leading={<img src={subdlLogo} alt="" draggable={false} className={LEAD_IMG} />}
            warn={subdlOn && !subdlKey ? t("This source stays quiet until you add a key.") : undefined}
          />
          {subdlOn && (
            <Nested>
              <SourceKeyField
                label={t("SUBDL API key")}
                iconSrc={subdlLogo}
                placeholder={t("Paste your SUBDL API key")}
                value={settings.subdlApiKey ?? ""}
                onCommit={(v) => update({ subdlApiKey: v })}
                help={
                  <>
                    {t("SUBDL returns nothing until a key is saved here.")}{" "}
                    <ExtLink href="https://subdl.com/panel/api">
                      {t("Get a free key at subdl.com")}
                    </ExtLink>
                  </>
                }
              />
            </Nested>
          )}
          <ToggleRow
            label={t("Subsource")}
            sub={t("A community subtitle source. Off until you add your Subsource API key.")}
            value={subsourceOn}
            onChange={(v) => setProv("subsource", v)}
            leading={<img src={subsourceLogo} alt="" draggable={false} className={LEAD_IMG} />}
            warn={
              subsourceOn && !subsourceKey
                ? t("This source stays quiet until you add a key.")
                : undefined
            }
          />
          {subsourceOn && (
            <Nested>
              <SourceKeyField
                label={t("Subsource API key")}
                iconSrc={subsourceLogo}
                placeholder={t("Paste your Subsource API key")}
                value={settings.subsourceApiKey ?? ""}
                onCommit={(v) => update({ subsourceApiKey: v })}
                help={
                  <>
                    {t("Subsource returns nothing until a key is saved here.")}{" "}
                    <ExtLink href="https://subsource.net">
                      {t("Get your key at subsource.net")}
                    </ExtLink>
                  </>
                }
              />
            </Nested>
          )}
        </SettingGroup>
      </Section>

      <Section
        title={t("Preferred languages")}
        subtitle={t("Every source above follows one language order, and it lives on the Languages page.")}
      >
        <SRow
          leading={<Languages size={20} strokeWidth={2} />}
          title={t("Subtitle language order")}
          description={t("Pick which languages Harbor looks for first, and which ones it falls back to.")}
          trailing={<NavChevron />}
          onClick={() => setActive("language")}
        />
      </Section>
    </>
  );
}
