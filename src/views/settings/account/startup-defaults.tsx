import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const INTERVALS = [
  ["launch", "Every launch"],
  ["15m", "Every 15 min"],
  ["30m", "Every 30 min"],
  ["never", "Never"],
] as const;

export function StartupDefaults() {
  const t = useT();
  const { settings, update } = useSettings();
  const { profiles } = useProfiles();
  const [open, setOpen] = useState(false);
  if (profiles.length <= 1) return null;
  const interval = settings.profilePromptInterval ?? "launch";
  const defaultId = settings.defaultProfileId ?? "";
  const defaultName = defaultId
    ? (profiles.find((p) => p.id === defaultId)?.name ?? t("Ask each time"))
    : t("Ask each time");
  const intervalLabel = t(INTERVALS.find(([v]) => v === interval)?.[1] ?? "Every launch");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge-soft/60 bg-canvas/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-3 text-start"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium text-ink">{t("Startup & default")}</span>
          <span className="truncate text-[11.5px] text-ink-subtle">
            {t("Who's watching: {a} · Default: {b}", { a: intervalLabel, b: defaultName })}
          </span>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] text-ink-muted">
              {t("How often the profile screen appears when you have more than one profile.")}
            </span>
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map(([val, label]) => {
                const active = interval === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update({ profilePromptInterval: val })}
                    className={`h-9 rounded-full border px-4 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-ink bg-ink text-canvas"
                        : "border-edge-soft bg-canvas/60 text-ink-muted hover:border-ink-subtle hover:text-ink"
                    }`}
                  >
                    {t(label)}
                  </button>
                );
              })}
            </div>
          </div>
          {profiles.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] text-ink-muted">
                {t("Skip Who's watching and always start as this profile. PIN-locked profiles can't be a default.")}
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "", label: t("Ask each time") },
                  ...profiles.filter((p) => !p.passwordHash).map((p) => ({ id: p.id, label: p.name })),
                ].map(({ id, label }) => {
                  const active = defaultId === id;
                  return (
                    <button
                      key={id || "ask"}
                      type="button"
                      onClick={() => update({ defaultProfileId: id })}
                      className={`h-9 rounded-full border px-4 text-[13px] font-medium transition-colors ${
                        active
                          ? "border-ink bg-ink text-canvas"
                          : "border-edge-soft bg-canvas/60 text-ink-muted hover:border-ink-subtle hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
