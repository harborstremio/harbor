import tvdbLogo from "@/assets/addon-logos/tvdb.svg";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider } from "@/lib/settings/episode-order";
import { useT } from "@/lib/i18n";
import { ToggleRow } from "./shared";

type Provider = "tvdb" | "tmdb";

function OrderPreview({ active }: { active: Provider }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3">
      <PreviewCard
        on={active === "tvdb"}
        logo={tvdbLogo}
        title="TVDB"
        tag={t("Structured")}
      >
        <div className="flex gap-1">
          {["Aired", "DVD", "Abs"].map((o, i) => (
            <span
              key={o}
              className={`rounded-full px-1.5 py-[3px] text-[8.5px] font-semibold ${
                i === 0 ? "bg-ink text-canvas" : "bg-elevated text-ink-subtle"
              }`}
            >
              {o}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex flex-col gap-1">
          {[
            { s: "Season 1", n: "12" },
            { s: "Season 2", n: "10" },
            { s: t("Specials"), n: "3" },
          ].map((r) => (
            <div
              key={r.s}
              className="flex items-center justify-between rounded-md bg-canvas px-2 py-1"
            >
              <span className="text-[9.5px] font-medium text-ink">{r.s}</span>
              <span className="text-[8.5px] text-ink-subtle">{r.n} eps</span>
            </div>
          ))}
        </div>
      </PreviewCard>
      <PreviewCard on={active === "tmdb"} logo={tmdbLogo} title="TMDB" tag={t("As aired")}>
        <div className="flex flex-col gap-1">
          {[
            { n: 1, name: "Pilot" },
            { n: 2, name: t("Episode 2") },
            { n: 3, name: t("Episode 3") },
            { n: 4, name: t("Episode 4") },
          ].map((e) => (
            <div key={e.n} className="flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-elevated text-[8px] font-semibold text-ink-subtle">
                {e.n}
              </span>
              <span className="truncate text-[9.5px] text-ink">{e.name}</span>
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
      className={`flex flex-col rounded-md border bg-canvas p-2.5 transition ${
        on ? "border-ink/80" : "border-edge-soft/60 opacity-45"
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <img src={logo} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
        <span className="text-[10.5px] font-semibold text-ink">{title}</span>
        <span className="ms-auto text-[8.5px] font-medium uppercase tracking-wide text-ink-subtle">
          {tag}
        </span>
      </div>
      {children}
    </div>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
 <div className="flex shrink-0 items-center gap-1 rounded-full bg-canvas p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-8 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${
            value === o.value ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
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
    <div className="mt-2 flex flex-col gap-4 border-t border-edge-soft/60 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-medium text-ink">{t("Episode ordering")}</span>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "How episodes are grouped for shows and anime. TVDB is the default: it gives the arc, DVD, and absolute orderings anime fans expect, with no key needed. TMDB keeps the plain aired order. Either way, every episode still plays and marks watched the same.",
            )}
          </span>
        </div>
        <Seg
          options={[
            { value: "tvdb", label: "TVDB" },
            { value: "tmdb", label: "TMDB" },
          ]}
          value={provider}
          onChange={pickProvider}
        />
      </div>

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
            <div className="flex items-center justify-between gap-4 ps-1">
              <span className="text-[13px] text-ink-muted">{t("Which order")}</span>
              <Seg
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
