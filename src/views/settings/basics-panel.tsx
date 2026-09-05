import { Check, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Flag } from "@/components/flag";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import omdbLogo from "@/assets/addon-logos/omdb.png";
import rpdbLogo from "@/assets/addon-logos/rpdb.png";
import tvdbLogo from "@/assets/addon-logos/tvdb.svg";
import fanartLogo from "@/assets/addon-logos/fanarttv.svg";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { getThemeById } from "@/lib/theme";
import { ROW_ACTION } from "./kit";
import { Section, useSettingsActiveContext } from "./shared";
import { SRow } from "./ui";

const ENGINE_LABEL: Record<string, string> = {
  auto: "Auto",
  html5: "HTML5",
  mpv: "mpv",
};

const THEME_SWATCH = ["var(--color-surface)", "var(--color-raised)", "var(--color-accent)"];

function Chevron() {
  return (
    <ChevronRight
      size={20}
      strokeWidth={2.2}
      className="shrink-0 text-ink-subtle rtl:-scale-x-100"
    />
  );
}

function Value({ children }: { children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[15.5px] leading-[22px] text-ink-muted">
      {children}
    </span>
  );
}

export function BasicsPanel() {
  const t = useT();
  const { user } = useAuth();
  const { settings, update } = useSettings();
  const { setActive } = useSettingsActiveContext();
  const [reveal, setReveal] = useState(false);

  const metaKeys = [
    { src: tmdbLogo, on: !!settings.tmdbKey, name: "TMDB" },
    { src: fanartLogo, on: !!settings.fanartKey, name: "Fanart" },
    { src: tvdbLogo, on: !!settings.tvdbKey, name: "TVDB" },
    { src: omdbLogo, on: !!settings.omdbKey, name: "OMDb" },
    { src: rpdbLogo, on: !!settings.rpdbKey, name: "RPDB" },
  ];
  const metaDone = metaKeys.filter((k) => k.on).length;
  const langs = settings.preferredLanguages;
  const engine = ENGINE_LABEL[settings.playerEngine] ?? settings.playerEngine;
  const themeName = getThemeById(settings.theme.preset)?.name ?? t("Custom theme");

  return (
    <>
      <Section title={t("Essentials")} subtitle={t("Four things worth checking once.")}>
        <SRow
          title={t("Stremio account")}
          description={
            user
              ? t("Signed in as {email}. Your library, add-ons and watch history sync with Stremio.", {
                  email: maskEmail(user.email, reveal),
                })
              : t("Sign in to sync your library, add-ons and watch history with Stremio.")
          }
          trailing={
            <>
              {user && (
                <button
                  type="button"
                  aria-label={reveal ? t("Hide email address") : t("Show email address")}
                  onClick={() => setReveal((v) => !v)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                >
                  {reveal ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              )}
              <button type="button" onClick={() => setActive("account")} className={ROW_ACTION}>
                {t("Open")}
              </button>
            </>
          }
        />

        <SRow
          title={t("Metadata providers")}
          description={t(
            "TMDB, Fanart, TVDB, OMDb and RPDB supply posters, artwork and ratings. Adding your own free keys makes artwork load faster and more completely.",
          )}
          onClick={() => setActive("library")}
          trailing={
            <>
              <span className="flex shrink-0 items-center gap-1.5">
                {metaKeys.map((k) => (
                  <img
                    key={k.name}
                    src={k.src}
                    alt={k.name}
                    className={`h-6 w-6 rounded-[6px] object-contain ${
                      k.on ? "opacity-100" : "opacity-30 grayscale"
                    }`}
                  />
                ))}
              </span>
              <Value>{t("{n} of {total}", { n: metaDone, total: metaKeys.length })}</Value>
              <Chevron />
            </>
          }
        />

        <SRow
          title={t("Player engine")}
          description={t(
            "Auto uses mpv when Harbor can reach it and falls back to the built in player. Pick one yourself if playback misbehaves.",
          )}
          onClick={() => setActive("player")}
          trailing={
            <>
              <Value>{engine}</Value>
              <Chevron />
            </>
          }
        />

        <SRow
          title={t("Preferred languages")}
          description={t(
            "Harbor puts streams, audio tracks and subtitles in these languages first. Leave it empty to accept anything.",
          )}
          onClick={() => setActive("language")}
          trailing={
            <>
              {langs.length > 0 && <Flag language={langs[0]} size="md" showLabel={false} />}
              <Value>
                {langs.length === 0
                  ? t("Any")
                  : langs.length === 1
                    ? langs[0]
                    : t("{n} languages", { n: langs.length })}
              </Value>
              <Chevron />
            </>
          }
        />
      </Section>

      <Section
        title={t("When you press Play")}
        subtitle={t("Pick one. You can change it any time.")}
      >
        <SRow
          title={t("Instant")}
          description={t("Harbor picks the best stream it can find and starts playing straight away.")}
          onClick={() => update({ instantPlay: true })}
          trailing={<Picked on={settings.instantPlay} />}
        />
        <SRow
          title={t("Pick a source")}
          description={t("Harbor shows the full list of streams every time so you choose one yourself.")}
          onClick={() => update({ instantPlay: false })}
          trailing={<Picked on={!settings.instantPlay} />}
        />
      </Section>

      <Section title={t("Make it yours")} subtitle={t("Colors, posters, fonts and wallpaper.")}>
        <SRow
          title={t("Theme and appearance")}
          description={t("Currently using {name}. Pick another preset or build your own.", {
            name: themeName,
          })}
          onClick={() => setActive("theme")}
          trailing={
            <>
              <span className="flex h-8 w-14 shrink-0">
                {THEME_SWATCH.map((c, i) => (
                  <span
                    key={c}
                    style={{ background: c }}
                    className={`h-full flex-1 ${i === 0 ? "rounded-s-[6px]" : ""} ${
                      i === THEME_SWATCH.length - 1 ? "rounded-e-[6px]" : ""
                    }`}
                  />
                ))}
              </span>
              <Chevron />
            </>
          }
        />
      </Section>
    </>
  );
}

function Picked({ on }: { on: boolean }) {
  const t = useT();
  if (!on) return <span className="block h-5 w-5 shrink-0" />;
  return (
    <span className="flex shrink-0 items-center gap-2">
      <Check size={20} strokeWidth={2.6} className="text-accent" />
      <span className="text-[15.5px] leading-[22px] font-medium text-accent">{t("Picked")}</span>
    </span>
  );
}

function maskEmail(email: string, reveal: boolean): string {
  if (reveal) return email;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 4))}@${domain}`;
}
