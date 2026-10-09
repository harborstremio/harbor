import { Flag } from "@/components/flag";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { useBpT } from "../../bp-i18n";
import { BpSubtitlePreview } from "../bp-subtitle-preview";
import {
  BP_ROW_FLUSH,
  BpDecisionNote,
  BpDecisionScroll,
} from "../bp-step-parts";

const COMMON = 24;
const PER_ROW = 4;
const ROW_SCOPE = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 88px" } as const;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function BpStepSubtitles() {
  const t = useBpT();
  const { settings, update } = useSettings();
  const picked = settings.preferredSubLangs;
  const common = ALL_LANGUAGE_NAMES.slice(0, COMMON);
  // A language chosen elsewhere but outside the common set still needs a cell,
  // otherwise this screen can select it away but never give it back.
  const options = [...common, ...picked.filter((l) => !common.includes(l))];

  const toggle = (lang: string) => {
    SFX.click();
    update({
      preferredSubLangs: picked.includes(lang)
        ? picked.filter((l) => l !== lang)
        : [...picked, lang],
    });
  };

  return (
    <BpDecisionScroll>
      <BpSubtitlePreview languages={picked} />
      {chunk(options, PER_ROW).map((row, ri) => (
        <div key={ri} data-bp-row style={ROW_SCOPE}>
          <div data-bp-scroll-x className="flex gap-[clamp(8px,0.8vw,16px)]">
            {row.map((lang) => {
              const at = picked.indexOf(lang);
              const on = at >= 0;
              return (
                <button
                  key={lang}
                  type="button"
                  data-bp-focusable
                  data-bp-chip
                  aria-pressed={on}
                  onClick={() => toggle(lang)}
                  className={`flex h-[clamp(54px,6.4vh,88px)] min-w-[44px] flex-1 items-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-md)] border px-[clamp(11px,1vw,20px)] text-start transition-colors duration-[var(--bp-dur-fast)] ${
                    on
                      ? "border-transparent bg-[var(--bp-glass)]"
                      : "border-[var(--bp-edge)] bg-[var(--bp-panel)]"
                  }`}
                >
                  {/* Flag renders nothing for a language it has no mark for, so
                      the slot is reserved or the row goes ragged. */}
                  <span className="flex w-[clamp(24px,2.8vh,38px)] shrink-0 items-center justify-center">
                    <Flag language={lang} size="md" showLabel={false} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[clamp(12.5px,1.75vh,21px)] font-semibold text-ink">
                    {lang}
                  </span>
                  {on && (
                    <span className="flex h-[clamp(22px,2.7vh,36px)] w-[clamp(22px,2.7vh,36px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-void)] text-[clamp(11px,1.5vh,17px)] font-bold text-ink">
                      {at + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <BpDecisionNote
        text={
          picked.length > 0
            ? t("In order: {list}", { list: picked.join(", ") })
            : t("Nothing selected. Harbor will not load a subtitle on its own.")
        }
      />
    </BpDecisionScroll>
  );
}
