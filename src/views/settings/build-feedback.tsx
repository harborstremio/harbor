import { Angry, Frown, Laugh, Meh, Smile, ThumbsUp } from "lucide-react";
import { GitHubIcon } from "@/components/github-icon";
import { useRef, useState, type ComponentType } from "react";
import { APP_VERSION, BUILD_LABEL, IS_BETA_BUILD } from "@/lib/build-info";
import { submitBuildFeedback } from "@/lib/build-feedback-submit";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { ROW_DESC, SettingRow } from "./kit";
import { stripArrowKeys } from "./shared";
import { SButton } from "./ui";

const KEY = "harbor.build.rating.v1";
const REPO_ISSUE = "https://github.com/harborstremio/harbor/issues/new";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const SCALE_LABEL = "text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle";

type Stop = {
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  tone: string;
};
const STOPS: Stop[] = [
  { label: "Much worse", Icon: Angry, tone: "text-danger" },
  { label: "Worse", Icon: Frown, tone: "text-danger/75" },
  { label: "About the same", Icon: Meh, tone: "text-ink-muted" },
  { label: "Better", Icon: Smile, tone: "text-success/80" },
  { label: "Much better", Icon: Laugh, tone: "text-success" },
];

const TITLE = "How is this build treating you?";

function readSaved(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { version?: string; value?: number };
    return o.version === APP_VERSION && typeof o.value === "number" ? o.value : null;
  } catch {
    return null;
  }
}

export function BuildFeedback() {
  const t = useT();
  const [value, setValue] = useState(() => readSaved() ?? 2);
  const [committed, setCommitted] = useState<number | null>(() => readSaved());
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const commit = () => {
    setCommitted(value);
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: APP_VERSION, value }));
    } catch {
      /* private mode */
    }
    void submitBuildFeedback(value);
  };

  const openIssue = (rating: number) => {
    const s = STOPS[rating];
    const title = `Beta feedback: ${APP_VERSION} feels ${s.label.toLowerCase()}`;
    const body = `**Build:** ${BUILD_LABEL}${IS_BETA_BUILD ? " (beta)" : ""}
**Platform:** ${navigator.platform || "unknown"}\n**How it feels:** ${s.label}\n\n**What got worse, or what broke?**\n\n\n**Steps to make it happen (if any):**\n\n\n_A screenshot helps us a ton._`;
    void openUrl(
      `${REPO_ISSUE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=feedback`,
    );
  };

  if (committed != null) {
    const s = STOPS[committed];
    const negative = committed <= 1;
    const rated = t("You rated this build {label}.", { label: t(s.label) });
    const icon = (
      <span className={s.tone}>
        <s.Icon size={20} strokeWidth={2} />
      </span>
    );

    if (negative) {
      return (
        <SettingRow wide icon={icon} label={t(TITLE)} desc={rated}>
          <div className="flex w-full flex-col items-start gap-3">
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t("Sorry this one is not better. Tell us what went wrong and we will fix it for you.")}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <SButton variant="primary" onClick={() => openIssue(committed)}>
                <GitHubIcon size={16} strokeWidth={2.2} />
                {t("Open a quick issue")}
              </SButton>
              <SButton onClick={() => setCommitted(null)}>{t("Change")}</SButton>
            </div>
          </div>
        </SettingRow>
      );
    }

    return (
      <SettingRow
        icon={icon}
        label={t(TITLE)}
        desc={
          <>
            <span className="block">{rated}</span>
            <span className="mt-1 flex items-start gap-2">
              <ThumbsUp size={16} strokeWidth={2.2} className="mt-[3px] shrink-0 text-accent" />
              {t("Thanks! This helps us know the betas are heading the right way.")}
            </span>
          </>
        }
      >
        <SButton onClick={() => setCommitted(null)}>{t("Change")}</SButton>
      </SettingRow>
    );
  }

  const cur = STOPS[value];
  return (
    <SettingRow
      wide
      icon={
        <span className={cur.tone}>
          <cur.Icon size={20} strokeWidth={2} />
        </span>
      }
      label={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{t(TITLE)}</span>
          {IS_BETA_BUILD && <span className={`${QUAL} bg-accent-soft text-accent`}>{t("Beta")}</span>}
        </span>
      }
      desc={t("Does Harbor {version} feel better or worse than the version you had before?", {
        version: APP_VERSION,
      })}
    >
      <div className="flex w-full max-w-[520px] flex-col gap-3">
        <div
          role="radiogroup"
          aria-label={t("Rate this build")}
          className="grid grid-cols-5 gap-1.5"
          onKeyDown={stripArrowKeys(tiles, setValue)}
        >
          {STOPS.map((s, i) => {
            const on = i === value;
            return (
              <button
                key={s.label}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t(s.label)}
                tabIndex={on ? 0 : -1}
                onClick={() => setValue(i)}
                className={`harbor-press-pop flex h-14 items-center justify-center rounded-[10px] border outline-none transition-colors duration-150 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  on ? `border-edge bg-elevated ${s.tone}` : "border-edge-soft text-ink-subtle hover:text-ink"
                }`}
              >
                <s.Icon size={on ? 26 : 22} strokeWidth={2} />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={SCALE_LABEL}>{t("Worse")}</span>
          <span className="text-[15.5px] font-semibold leading-[22px] text-ink">{t(cur.label)}</span>
          <span className={SCALE_LABEL}>{t("Better")}</span>
        </div>

        <SButton variant="primary" onClick={commit} className="self-start">
          {t("Send rating")}
        </SButton>
      </div>
    </SettingRow>
  );
}
