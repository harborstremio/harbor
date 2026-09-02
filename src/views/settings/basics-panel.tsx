import { ChevronRight, Eye, EyeOff } from "lucide-react";
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
import { PlayModeChoice } from "./player-panel/play-mode-section";
import { Section, useSettingsActiveContext } from "./shared";

const ENGINE_LABEL: Record<string, string> = {
  auto: "Auto",
  html5: "HTML5",
  mpv: "mpv",
};

export function BasicsPanel() {
  const t = useT();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { setActive } = useSettingsActiveContext();
  const [reveal, setReveal] = useState(false);

  const metaKeys = [
    { src: tmdbLogo, on: !!settings.tmdbKey, name: "TMDB" },
    { src: fanartLogo, on: !!settings.fanartKey, name: "Fanart" },
    { src: tvdbLogo, on: !!settings.tvdbKey, name: "TVDB" },
    { src: omdbLogo, on: !!settings.omdbKey, name: "OMDb" },
    { src: rpdbLogo, on: !!settings.rpdbKey, name: "RPDB" },
  ];
  const langs = settings.preferredLanguages;

  return (
    <>
      <Section title={t("Set up")} subtitle={t("Four things worth checking once.")}>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <Tile
            label={t("Stremio account")}
            value={user ? maskEmail(user.email, reveal) : t("Not signed in")}
            ok={!!user}
            onClick={() => setActive("account")}
            action={
              user ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={reveal ? t("Hide") : t("Show")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReveal((v) => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setReveal((v) => !v);
                    }
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
                >
                  {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                </span>
              ) : undefined
            }
          />
          <MetadataTile
            keys={metaKeys}
            onClick={() => setActive("library")}
          />
          <Tile
            label={t("Player engine")}
            value={ENGINE_LABEL[settings.playerEngine] ?? settings.playerEngine}
            ok
            onClick={() => setActive("player")}
          />
          <Tile
            label={t("Language")}
            value={langs.length === 0 ? t("Any") : langs.length === 1 ? langs[0] : t("{n} languages", { n: langs.length })}
            ok
            leading={langs.length > 0 ? <Flag language={langs[0]} size="sm" showLabel={false} /> : undefined}
            onClick={() => setActive("language")}
          />
        </div>
      </Section>

      <Section title={t("When you press Play")} subtitle={t("Pick one. You can change it any time.")}>
        <PlayModeChoice />
      </Section>

      <Section title={t("Make it yours")} subtitle={t("Colors, posters, fonts and wallpaper.")}>
        <ThemeJump preset={settings.theme.preset} onClick={() => setActive("theme")} />
      </Section>
    </>
  );
}

function Tile({
  label,
  value,
  onClick,
  action,
  leading,
}: {
  label: string;
  value: string;
  ok?: boolean;
  onClick: () => void;
  action?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-md bg-elevated px-4 py-3.5 text-start transition-colors hover:bg-raised"
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[12.5px] uppercase tracking-[0.12em] text-ink-subtle">{label}</span>
        <span className="truncate text-[13.5px] font-medium text-ink">{value}</span>
      </span>
      {action}
      <ChevronRight
        size={16}
        strokeWidth={2.2}
        className="shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
      />
    </button>
  );
}

const PRESET_SWATCH: Record<string, string[]> = {
  harbor: ["bg-canvas", "bg-elevated", "bg-accent"],
  noir: ["bg-black", "bg-neutral-800", "bg-neutral-400"],
  kids: ["bg-sky-200", "bg-sky-400", "bg-amber-300"],
};

function ThemeJump({ preset, onClick }: { preset: string; onClick: () => void }) {
  const t = useT();
  const swatch = PRESET_SWATCH[preset] ?? PRESET_SWATCH.harbor;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-md bg-elevated px-4 py-3.5 text-start transition-colors hover:bg-raised"
    >
      <span className="flex h-9 w-14 shrink-0 overflow-hidden rounded-[4px]">
        {swatch.map((c, i) => (
          <span key={i} className={`h-full flex-1 ${c}`} />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-ink">{prettyPreset(preset)}</span>
        <span className="text-[12.5px] text-ink-subtle">{t("Change the look")}</span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={2.2}
        className="shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
      />
    </button>
  );
}

function prettyPreset(id: string): string {
  if (!id) return "Harbor";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function maskEmail(email: string, reveal: boolean): string {
  if (reveal) return email;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 4))}@${domain}`;
}

function MetadataTile({
  keys,
  onClick,
}: {
  keys: Array<{ src: string; on: boolean; name: string }>;
  onClick: () => void;
}) {
  const t = useT();
  const done = keys.filter((k) => k.on).length;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-md bg-elevated px-4 py-3.5 text-start transition-colors hover:bg-raised"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[12.5px] uppercase tracking-[0.12em] text-ink-subtle">
          {t("Metadata providers")}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            {keys.map((k) => (
              <img
                key={k.name}
                src={k.src}
                alt={k.name}
                title={k.name}
                className={`h-5 w-5 rounded-[3px] object-contain transition-opacity ${
                  k.on ? "opacity-100" : "opacity-25 grayscale"
                }`}
              />
            ))}
          </span>
          <span className="text-[13px] font-medium text-ink">
            {t("{n} of {total}", { n: done, total: keys.length })}
          </span>
        </span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={2.2}
        className="shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
      />
    </button>
  );
}
