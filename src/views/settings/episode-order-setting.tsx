import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

import { ToggleRow } from "./shared";

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
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-edge-soft bg-canvas/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-8 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors ${
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
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-edge-soft/60 pt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-medium text-ink">{t("Episode ordering")}</span>
          <span className="text-[12px] leading-relaxed text-ink-subtle">
            {t(
              "How episodes are grouped for shows and anime. Default keeps TMDB's aired order; TVDB gives the arc/season orderings anime fans prefer. Each episode still plays and marks watched the same.",
            )}
          </span>
        </div>
        <Seg
          options={[
            { value: "default", label: t("Default") },
            { value: "tvdb", label: t("TVDB") },
          ]}
          value={settings.episodeOrderProvider === "tvdb" ? "tvdb" : "default"}
          onChange={(v) => update({ episodeOrderProvider: v })}
        />
      </div>
      {settings.episodeOrderProvider === "tvdb" && !settings.tvdbOrderPanel && (
        <div className="flex items-center justify-between gap-4 ps-1">
          <span className="text-[13px] text-ink-muted">{t("TVDB order")}</span>
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
      <ToggleRow
        label={t("TVDB season and order panel")}
        sub={t(
          "Turn the season button into a TVDB-style panel: order tabs (Aired, DVD, Absolute, and any the show has) plus a season table with air-date ranges and episode counts. Needs a TVDB key.",
        )}
        value={settings.tvdbOrderPanel}
        onChange={(v) => update({ tvdbOrderPanel: v })}
      />
    </div>
  );
}
