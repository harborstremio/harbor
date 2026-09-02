import { Angry, Frown, Laugh, Meh, Smile, ThumbsUp } from "lucide-react";
import { GitHubIcon } from "@/components/github-icon";
import { useRef, useState, type ComponentType } from "react";
import { BetaTag } from "@/components/beta-tag";
import { APP_VERSION, BUILD_LABEL, IS_BETA_BUILD } from "@/lib/build-info";
import { submitBuildFeedback } from "@/lib/build-feedback-submit";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";

const KEY = "harbor.build.rating.v1";
const REPO_ISSUE = "https://github.com/harborstremio/harbor/issues/new";

type Stop = {
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  color: string;
};
const STOPS: Stop[] = [
  { label: "Much worse", Icon: Angry, color: "#e06060" },
  { label: "Worse", Icon: Frown, color: "#d69352" },
  { label: "About the same", Icon: Meh, color: "#9aa3af" },
  { label: "Better", Icon: Smile, color: "#5cbb8a" },
  { label: "Much better", Icon: Laugh, color: "#4bb87c" },
];

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

  const move = (next: number) => {
    const i = Math.max(0, Math.min(STOPS.length - 1, next));
    setValue(i);
    tiles.current[i]?.focus();
  };

  if (committed != null) {
    const s = STOPS[committed];
    const negative = committed <= 1;
    return (
      <div className="flex flex-col gap-3 rounded-md bg-canvas px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="shrink-0" style={{ color: s.color }}>
            <s.Icon size={20} strokeWidth={2} />
          </span>
          <p className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">
            {t("You rated this build {label}.", { label: t(s.label) })}
          </p>
          <button
            type="button"
            onClick={() => setCommitted(null)}
            className="shrink-0 text-[12.5px] font-medium text-ink-subtle underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            {t("Change")}
          </button>
        </div>
        {negative ? (
          <div className="flex flex-col items-start gap-2.5 rounded-md bg-elevated p-3.5">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {t(
                "Sorry this one is not better. Tell us what went wrong and we will fix it for you.",
              )}
            </p>
            <button
              type="button"
              onClick={() => openIssue(committed)}
              className="harbor-press-pop flex h-9 items-center gap-2 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas"
            >
              <GitHubIcon size={15} strokeWidth={2.2} />
              {t("Open a quick issue")}
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <ThumbsUp size={14} strokeWidth={2.2} className="text-accent" />
            {t("Thanks! This helps us know the betas are heading the right way.")}
          </p>
        )}
      </div>
    );
  }

  const cur = STOPS[value];
  return (
    <div className="flex flex-col gap-3.5 rounded-md bg-canvas px-4 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
          {t("How is this build treating you?")}
          <BetaTag />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t("Does Harbor {version} feel better or worse than the version you had before?", {
            version: APP_VERSION,
          })}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("Rate this build")}
        className="grid grid-cols-5 gap-1.5"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(value - 1);
          } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(value + 1);
          }
        }}
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
              className={`harbor-press-pop flex h-14 items-center justify-center rounded-md outline-none transition-colors duration-150 ease-in-out ${
                on ? "bg-elevated" : "bg-transparent hover:bg-elevated/45"
              }`}
              style={on ? { color: s.color } : undefined}
            >
              <span className={on ? "" : "text-ink-subtle"}>
                <s.Icon size={on ? 24 : 20} strokeWidth={2} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("Worse")}
        </span>
        <span className="text-[13px] font-semibold text-ink">{t(cur.label)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("Better")}
        </span>
      </div>

      <button
        type="button"
        onClick={commit}
        className="harbor-press-pop flex h-10 items-center justify-center self-start rounded-md bg-ink px-5 text-[13px] font-semibold text-canvas"
      >
        {t("Send rating")}
      </button>
    </div>
  );
}
