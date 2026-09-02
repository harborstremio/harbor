import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Section } from "./shared";

const CHOICES = [15, 30, 45, 60, 90] as const;

export function AddonTimeoutSetting() {
  const t = useT();
  const { settings, update } = useSettings();
  const raw = settings.addonTimeoutSec ?? 30;
  const current = CHOICES.includes(raw as (typeof CHOICES)[number]) ? raw : 30;
  const max = CHOICES[CHOICES.length - 1];

  return (
    <Section title={t("Addon wait time")}>
      <div className="flex flex-col gap-4 rounded-md bg-elevated px-5 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Give each addon")}
          </span>
          <span className="font-display text-[28px] font-medium leading-none tabular-nums text-ink">
            {current}
            <span className="ps-1 text-[15px] text-ink-subtle">s</span>
          </span>
        </div>

        <div className="flex items-end gap-1.5">
          {CHOICES.map((sec) => {
            const on = sec === current;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => update({ addonTimeoutSec: sec })}
                aria-pressed={on}
                className="group flex flex-1 flex-col items-center gap-2"
              >
                <span
                  className={`block w-full rounded-[3px] transition-[height,background-color] duration-300 ease-in-out ${
                    on ? "bg-ink" : "bg-canvas group-hover:bg-raised"
                  }`}
                  style={{ height: 14 + (sec / max) * 40 }}
                />
                <span
                  className={`text-[11.5px] font-semibold tabular-nums transition-colors ${
                    on ? "text-ink" : "text-ink-subtle group-hover:text-ink-muted"
                  }`}
                >
                  {sec}
                </span>
              </button>
            );
          })}
        </div>

        <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-ink-subtle">
          {t("Aggregators that search many sources can need 45s or more. Results appear as each addon answers, so a longer wait never delays the fast ones. Raise this if an addon usually shows nothing until you hit refresh a few times.")}
        </p>
      </div>
    </Section>
  );
}
