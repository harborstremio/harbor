import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const OPTIONS = [
  [
    "shared",
    "Share settings with all profiles",
    "One set of preferences everyone on this Harbor uses.",
  ],
  [
    "independent",
    "Use independent settings for this profile",
    "This profile keeps its own preferences, separate from everyone else.",
  ],
] as const;

export function SettingsScopeCard() {
  const t = useT();
  const { activeProfile, updateProfile } = useProfiles();
  const { setSettingsLinked } = useSettings();
  if (!activeProfile) return null;
  const linked = activeProfile.settingsLinked !== false;
  const setScope = (next: boolean) => {
    if (next === linked) return;
    setSettingsLinked(next);
    updateProfile(activeProfile.id, { settingsLinked: next });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge-soft/60 bg-canvas/30 p-3">
      <span className="text-[13px] font-medium text-ink">{t("Settings for this profile")}</span>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(([key, label, desc]) => {
          const active = key === "shared" ? linked : !linked;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key === "shared")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-start transition-colors ${
                active
                  ? "border-ink bg-canvas/60"
                  : "border-edge-soft bg-canvas/40 hover:border-ink-subtle"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? "border-ink" : "border-edge"
                }`}
              >
                {active && <span className="h-2 w-2 rounded-full bg-ink" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-ink">{t(label)}</span>
                <span className="text-[11.5px] leading-relaxed text-ink-subtle">{t(desc)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
