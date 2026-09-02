import { useBpT } from "../../bp-i18n";
import { BpDecisionNote, BpDecisionScroll, BpTick } from "../bp-step-parts";
import { useBpOnboardFacts } from "../use-bp-onboard-facts";
import { BpDoneFlourish } from "../bp-done-flourish";

type Line = { key: string; on: boolean; text: string };

export function BpStepDone() {
  const t = useBpT();
  const facts = useBpOnboardFacts();

  const lines: Line[] = [
    {
      key: "tmdb",
      on: facts.tmdbKey.trim().length > 0,
      text: facts.tmdbKey.trim()
        ? t("TMDB connected")
        : t("Running on Cinemeta. Add a TMDB key in Settings whenever you want."),
    },
    {
      key: "services",
      on: facts.servicesOn > 0,
      text: t("{n} streaming services on", { n: facts.servicesOn }),
    },
    {
      key: "stremio",
      on: facts.stremioName !== null,
      text: facts.stremioName
        ? t("Signed in as {name}", { name: facts.stremioName })
        : t("Not signed in to Stremio. Your library stays local."),
    },
    {
      key: "harbor",
      on: facts.harborName !== null,
      text: facts.harborName
        ? t("Harbor account linked as {name}", { name: facts.harborName })
        : t("No Harbor account yet"),
    },
    {
      key: "subs",
      on: facts.subLangs.length > 0,
      text:
        facts.subLangs.length > 0
          ? t("Subtitles: {list}", { list: facts.subLangs.join(", ") })
          : t("No subtitle languages set"),
    },
  ];
  if (facts.tastePicks > 0) {
    lines.push({ key: "taste", on: true, text: t("{n} titles you like", { n: facts.tastePicks }) });
  }

  return (
    <BpDecisionScroll>
      <BpDoneFlourish />
      <ul className="flex shrink-0 flex-col gap-[clamp(5px,0.7vh,11px)]">
        {lines.map((l) => (
          <li
            key={l.key}
            className="flex items-center gap-[clamp(11px,1.1vw,20px)] text-[clamp(12px,1.65vh,20px)] font-semibold"
          >
            <BpTick on={l.on} />
            <span className={l.on ? "text-ink" : "text-ink-subtle"}>{l.text}</span>
          </li>
        ))}
      </ul>
      <BpDecisionNote
        text={t("Everything here took effect straight away, and it is saved on this device.")}
      />
    </BpDecisionScroll>
  );
}
