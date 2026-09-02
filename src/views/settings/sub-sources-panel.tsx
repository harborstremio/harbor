import { useEffect, useState } from "react";
import { Eye, EyeOff, Key, Languages, Puzzle } from "lucide-react";
import wyzieLogo from "@/assets/wyzie.png";
import { useAuth } from "@/lib/auth";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow, useSettingsActiveContext } from "./shared";
import { ModalButton, SettingGroup, SettingRow, SettingsModal, Nested } from "./kit";
import { OpenSubsMark, SubdlMark, SubsourceMark } from "./sub-source-marks";

type ProvKey = "opensubtitles" | "wyzie" | "addons" | "subdl" | "subsource";

const LINK_BUTTON =
  "harbor-press-pop flex h-9 shrink-0 items-center rounded-md bg-raised px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink";

function Favicon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-9 w-9 shrink-0 rounded-md object-cover"
    />
  );
}

function AddonAvatar({ addon, z }: { addon: Addon; z: number }) {
  const [broken, setBroken] = useState(false);
  const logo = addon.manifest.logo;
  const letter = (addon.manifest.name?.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-canvas"
      style={{ zIndex: z }}
    >
      {logo && !broken ? (
        <img
          src={logo}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[12.5px] font-bold text-ink-subtle">{letter}</span>
      )}
    </span>
  );
}

function AddonStack({ addons }: { addons: Addon[] }) {
  const shown = addons.slice(0, 3);
  return (
    <span className="flex h-9 shrink-0 items-center">
      <span className="flex -space-x-1.5">
        {shown.map((a, i) => (
          <AddonAvatar key={a.transportUrl} addon={a} z={shown.length - i} />
        ))}
      </span>
    </span>
  );
}

function EmptyAddonIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-subtle">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M6.5 14h4M13 14h4.5M6.5 10.5h3M12 10.5h5.5" />
      </svg>
    </span>
  );
}

function ApiKeyRow({
  title,
  sub,
  keyValue,
  onKey,
  placeholder,
  help,
  emptyDesc,
  emptyWarn,
}: {
  title: string;
  sub: string;
  keyValue: string;
  onKey: (v: string) => void;
  placeholder: string;
  help: React.ReactNode;
  emptyDesc?: string;
  emptyWarn?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const hasKey = keyValue.trim().length > 0;

  return (
    <>
      <SettingRow
        icon={<Key size={16} />}
        label={t("API key")}
        desc={hasKey ? t("Saved on this device") : emptyDesc}
        warn={hasKey ? undefined : emptyWarn}
      >
        <button type="button" onClick={() => setOpen(true)} className={LINK_BUTTON}>
          {hasKey ? t("Change key") : t("Add key")}
        </button>
      </SettingRow>
      <SettingsModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        sub={sub}
        actions={<ModalButton onClick={() => setOpen(false)}>{t("Done")}</ModalButton>}
      >
        <SettingRow wide icon={<Key size={16} />} label={t("API key")} desc={help}>
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <input
              type={reveal ? "text" : "password"}
              value={keyValue}
              onChange={(e) => onKey(e.target.value)}
              placeholder={placeholder}
              spellCheck={false}
              autoComplete="off"
              className="h-11 w-full min-w-0 rounded-md bg-canvas px-3.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:bg-surface"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? t("Hide") : t("Show")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-canvas text-ink-subtle transition-colors hover:text-ink"
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </SettingRow>
      </SettingsModal>
    </>
  );
}

function KeyedSource({
  label,
  sub,
  leading,
  on,
  onToggle,
  keyValue,
  onKey,
  placeholder,
  help,
}: {
  label: string;
  sub: string;
  leading: React.ReactNode;
  on: boolean;
  onToggle: (v: boolean) => void;
  keyValue: string;
  onKey: (v: string) => void;
  placeholder: string;
  help: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <ToggleRow label={label} sub={sub} value={on} onChange={onToggle} leading={leading} />
      {on && (
        <Nested>
          <ApiKeyRow
            title={label}
            sub={sub}
            keyValue={keyValue}
            onKey={onKey}
            placeholder={placeholder}
            help={help}
            emptyWarn={t("This source stays quiet until you add a key.")}
          />
        </Nested>
      )}
    </div>
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

  const addonCount = addons?.length ?? null;
  const addonSub =
    addonCount === null
      ? t("Any Stremio subtitle addons you have installed are searched here too.")
      : addonCount > 0
        ? t("{count} installed. Add or remove them under Streaming sources.", { count: addonCount })
        : t("None installed yet. Add Stremio subtitle addons under Streaming sources.");
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
            leading={<OpenSubsMark />}
          />
          {osOn && (
            <Nested>
              <ApiKeyRow
                title={t("OpenSubtitles")}
                sub={t("Searching works without a key. A key lets Harbor line subtitles up with the audio automatically.")}
                keyValue={settings.opensubtitlesApiKey ?? ""}
                onKey={(v) => update({ opensubtitlesApiKey: v })}
                placeholder={t("Paste your OpenSubtitles API key")}
                emptyDesc={t("Optional. Add one to turn on automatic subtitle sync.")}
                help={
                  <button
                    type="button"
                    onClick={() => openUrl("https://www.opensubtitles.com/consumers")}
                    className="text-accent underline-offset-2 transition-colors hover:underline"
                  >
                    {t("Get a free key at opensubtitles.com")}
                  </button>
                }
              />
            </Nested>
          )}
          <ToggleRow
            label={t("Wyzie")}
            sub={t("A fast community subtitle index. Off by default; turn it on for extra coverage on newer or niche releases.")}
            value={wyzieOn}
            onChange={(v) => setProv("wyzie", v)}
            leading={<Favicon src={wyzieLogo} />}
          />
        </SettingGroup>

        <SettingGroup label={t("From your addons")}>
          <ToggleRow
            label={t("Subtitle addons")}
            sub={addonSub}
            value={addonsOn}
            onChange={(v) => setProv("addons", v)}
            leading={addons && addons.length > 0 ? <AddonStack addons={addons} /> : <EmptyAddonIcon />}
          />
          <Nested>
            <SettingRow icon={<Puzzle size={16} />} label={t("Installed addons")} desc={addonNames}>
              <button type="button" onClick={() => setActive("streaming")} className={LINK_BUTTON}>
                {t("Manage subtitle addons in Streaming sources")}
              </button>
            </SettingRow>
          </Nested>
        </SettingGroup>

        <SettingGroup label={t("Needs an API key")}>
          <KeyedSource
            label={t("SUBDL")}
            sub={t("A large multi-language subtitle database. Off until you add your free SUBDL API key.")}
            leading={<SubdlMark />}
            on={subdlOn}
            onToggle={(v) => setProv("subdl", v)}
            keyValue={settings.subdlApiKey ?? ""}
            onKey={(v) => update({ subdlApiKey: v })}
            placeholder={t("Paste your SUBDL API key")}
            help={
              <button
                type="button"
                onClick={() => openUrl("https://subdl.com/panel/api")}
                className="text-accent underline-offset-2 transition-colors hover:underline"
              >
                {t("Get a free key at subdl.com")}
              </button>
            }
          />
          <KeyedSource
            label={t("Subsource")}
            sub={t("A community subtitle source. Off until you add your Subsource API key.")}
            leading={<SubsourceMark />}
            on={subsourceOn}
            onToggle={(v) => setProv("subsource", v)}
            keyValue={settings.subsourceApiKey ?? ""}
            onKey={(v) => update({ subsourceApiKey: v })}
            placeholder={t("Paste your Subsource API key")}
            help={
              <button
                type="button"
                onClick={() => openUrl("https://subsource.net")}
                className="text-accent underline-offset-2 transition-colors hover:underline"
              >
                {t("Get your key at subsource.net")}
              </button>
            }
          />
        </SettingGroup>
      </Section>

      <Section
        title={t("Preferred languages")}
        subtitle={t("The languages above all obey your preferred subtitle language order, which lives in the Languages page.")}
      >
        <SettingRow icon={<Languages size={16} />} label={t("Subtitle language order")}>
          <button type="button" onClick={() => setActive("language")} className={LINK_BUTTON}>
            {t("Open Languages")}
          </button>
        </SettingRow>
      </Section>
    </>
  );
}
