import { ChevronDown } from "../icons";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { RowNote, Section } from "../shared";
import { compileMpvOptions, validateMpvOptions } from "@/lib/player/mpv-tuning";

export function AdvancedMpvSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [showCompiled, setShowCompiled] = useState(false);
  const value = settings.mpvExtraOptions;
  const check = validateMpvOptions(value);
  const compiled = compileMpvOptions(settings);
  return (
    <Section
      title={t("Advanced (mpv.conf)")}
      subtitle={t("The escape hatch for power users. One mpv option per line as key=value, exactly like mpv.conf. These apply last, so they override every dial above. Anything Harbor can't read is skipped, so a typo won't break playback. Restart playback to apply.")}
    >
      <textarea
        value={value}
        onChange={(e) => update({ mpvExtraOptions: e.target.value })}
        spellCheck={false}
        rows={6}
        aria-label={t("Advanced (mpv.conf)")}
        placeholder={"tone-mapping=hable\ninverse-tone-mapping=yes\nbrightness=5\nsub-scale=1.2"}
        className="block w-full resize-y rounded-[10px] border border-edge-soft bg-elevated px-4 py-3 font-mono text-[15.5px] leading-[22px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <p className="flex max-w-[70ch] flex-wrap items-center gap-x-4 gap-y-1 text-[15.5px] leading-[22px]">
        {check.valid > 0 && (
          <span className="font-medium text-success">
            {check.valid === 1 ? t("1 option active") : t("{n} options active", { n: check.valid })}
          </span>
        )}
        {check.skipped > 0 && (
          <span className="text-ink-subtle">
            {check.skipped === 1 ? t("1 line skipped (not valid)") : t("{n} lines skipped (not valid)", { n: check.skipped })}
          </span>
        )}
        {check.valid === 0 && check.skipped === 0 && (
          <span className="text-ink-subtle">{t("Empty. The dials above cover what most people ever need.")}</span>
        )}
      </p>
      {check.risky.length > 0 && (
        <RowNote>
          {t("Heads up: {keys} can load outside scripts or open your player to the network. Only keep these if you know exactly what they do.", {
            keys: check.risky.join(", "),
          })}
        </RowNote>
      )}
      {compiled && (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setShowCompiled((v) => !v)}
            aria-expanded={showCompiled}
            className="flex min-h-11 w-fit items-center gap-2 text-start text-[15.5px] font-medium leading-[22px] text-ink-muted transition-colors hover:text-ink"
          >
            <ChevronDown
              size={18}
              className={`shrink-0 transition-transform duration-200 ${showCompiled ? "rotate-180" : ""}`}
            />
            {t("See the mpv.conf your dials above generate")}
          </button>
          {showCompiled && (
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-elevated px-4 py-3 font-mono text-[15.5px] leading-[22px] text-ink-muted">
              {compiled}
            </pre>
          )}
        </div>
      )}
    </Section>
  );
}
