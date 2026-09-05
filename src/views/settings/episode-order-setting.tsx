import tvdbLogo from "@/assets/addon-logos/tvdb.svg";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider } from "@/lib/settings/episode-order";
import { useT } from "@/lib/i18n";
import { Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";

type Provider = "tvdb" | "tmdb";

const TAG =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-elevated px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle";

function OrderPreview({ active }: { active: Provider }) {
  const t = useT();
  return (
    <div className="grid w-full grid-cols-2 gap-3">
      <PreviewCard on={active === "tvdb"} logo={tvdbLogo} title="TVDB" tag={t("Structured")}>
        <div className="flex flex-wrap gap-1.5">
          {["Aired", "DVD", "Abs"].map((o, i) => (
            <span
              key={o}
              className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                i === 0 ? "bg-ink text-canvas" : "bg-elevated text-ink-subtle"
              }`}
            >
              {o}
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {[
            { s: "Season 1", n: "12" },
            { s: "Season 2", n: "10" },
            { s: t("Specials"), n: "3" },
          ].map((r) => (
            <div
              key={r.s}
              className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-1.5"
            >
              <span className="min-w-0 truncate text-[15.5px] font-medium leading-[22px] text-ink">
                {r.s}
              </span>
              <span className="shrink-0 text-[15.5px] leading-[22px] text-ink-subtle">
                {t("{n} eps", { n: r.n })}
              </span>
            </div>
          ))}
        </div>
      </PreviewCard>
      <PreviewCard on={active === "tmdb"} logo={tmdbLogo} title="TMDB" tag={t("As aired")}>
        <div className="flex flex-col gap-1.5">
          {[
            { n: 1, name: "Pilot" },
            { n: 2, name: t("Episode 2") },
            { n: 3, name: t("Episode 3") },
            { n: 4, name: t("Episode 4") },
          ].map((e) => (
            <div key={e.n} className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-elevated text-[13px] font-bold tabular-nums text-ink-subtle">
                {e.n}
              </span>
              <span className="min-w-0 truncate text-[15.5px] leading-[22px] text-ink">
                {e.name}
              </span>
            </div>
          ))}
        </div>
      </PreviewCard>
    </div>
  );
}

function PreviewCard({
  on,
  logo,
  title,
  tag,
  children,
}: {
  on: boolean;
  logo: string;
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-md border bg-canvas p-3.5 transition ${
        on ? "border-ink/80" : "border-edge-soft/60 opacity-45"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <img src={logo} alt="" className="h-5 w-5 shrink-0 rounded-[3px] object-contain" />
        <span className="min-w-0 truncate text-[16.5px] font-medium leading-[24px] text-ink">
          {title}
        </span>
        <span className={`ms-auto ${TAG}`}>{tag}</span>
      </div>
      {children}
    </div>
  );
}

export function EpisodeOrderSetting() {
  const { settings, update } = useSettings();
  const t = useT();
  const provider: Provider = effectiveOrderProvider(settings);

  const pickProvider = (p: Provider) => {
    if (p === "tvdb") update({ episodeOrderProvider: "tvdb", tvdbOrderPanel: true });
    else update({ episodeOrderProvider: "tmdb", tvdbOrderPanel: false });
  };

  return (
    <>
      <SettingRow
        label={t("Episode ordering")}
        desc={t(
          "How episodes are grouped for shows and anime. TVDB is the default: it gives the arc, DVD, and absolute orderings anime fans expect, with no key needed. TMDB keeps the plain aired order. Either way, every episode still plays and marks watched the same.",
        )}
      >
        <Segmented
          options={[
            { value: "tvdb", label: "TVDB" },
            { value: "tmdb", label: "TMDB" },
          ]}
          value={provider}
          onChange={pickProvider}
        />
      </SettingRow>

      <OrderPreview active={provider} />

      {provider === "tvdb" && (
        <>
          <ToggleRow
            label={t("Rich season and order panel")}
            sub={t(
              "Turns the season button into a full panel: order tabs (Aired, DVD, Absolute, and any the show has) plus a season table with air-date ranges and episode counts. On by default for anime through Harbor's TVDB service, no key needed. Add your own TVDB key to use it for regular shows too.",
            )}
            value={settings.tvdbOrderPanel}
            onChange={(v) => update({ tvdbOrderPanel: v })}
          />
          {!settings.tvdbOrderPanel && (
            <SettingRow wide label={t("Which order")}>
              <Segmented
                options={[
                  { value: "aired", label: t("Aired") },
                  { value: "official", label: t("Official") },
                  { value: "dvd", label: t("DVD") },
                  { value: "absolute", label: t("Absolute") },
                  { value: "alternate", label: t("Alternate") },
                ]}
                value={settings.tvdbSeasonType}
                onChange={(v) => update({ tvdbSeasonType: v })}
              />
            </SettingRow>
          )}
        </>
      )}
    </>
  );
}
