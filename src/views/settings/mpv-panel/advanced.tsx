import { useT } from "@/lib/i18n";
import { compileMpvOptions, validateMpvOptions } from "@/lib/player/mpv-tuning";
import { useSettings } from "@/lib/settings";
import { AlertTriangle } from "lucide-react";

import { Section } from "../shared";

export function AdvancedMpvSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const value = settings.mpvExtraOptions;
  const check = validateMpvOptions(value);
  const compiled = compileMpvOptions(settings);
  return (
    <Section
      title={t("Advanced (mpv.conf)")}
      subtitle={t(
        "The escape hatch for power users. One mpv option per line as key=value, exactly like mpv.conf. These apply last, so they override every dial above. Anything Harbor can't read is skipped, so a typo won't break playback. Restart playback to apply.",
      )}
    >
      <textarea
        value={value}
        onChange={(e) => update({ mpvExtraOptions: e.target.value })}
        spellCheck={false}
        rows={5}
        placeholder={"tone-mapping=hable\ninverse-tone-mapping=yes\nbrightness=5\nsub-scale=1.2"}
        className="w-full resize-y rounded-xl border border-edge-soft bg-canvas/60 px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-ink-subtle outline-none focus:border-edge"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
        {check.valid > 0 && (
          <span className="font-medium text-emerald-400">
            {check.valid === 1 ? t("1 option active") : t("{n} options active", { n: check.valid })}
          </span>
        )}
        {check.skipped > 0 && (
          <span className="text-ink-subtle">
            {check.skipped === 1
              ? t("1 line skipped (not valid)")
              : t("{n} lines skipped (not valid)", { n: check.skipped })}
          </span>
        )}
        {check.valid === 0 && check.skipped === 0 && (
          <span className="text-ink-subtle">{t("Empty. The dials above cover what most people ever need.")}</span>
        )}
      </div>
      {check.risky.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-3 text-[12px] leading-snug text-ink">
          <AlertTriangle size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-300" />
          <span>
            {t(
              "Heads up: {keys} can load outside scripts or open your player to the network. Only keep these if you know exactly what they do.",
              {
                keys: check.risky.join(", "),
              },
            )}
          </span>
        </div>
      )}
      {compiled && (
        <details className="group rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-2.5">
          <summary className="cursor-pointer list-none text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
            {t("See the mpv.conf your dials above generate")}
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink-subtle">
            {compiled}
          </pre>
        </details>
      )}
    </Section>
  );
}
