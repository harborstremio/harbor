import { Angry, Frown, Laugh, Meh, Smile, ThumbsUp } from "lucide-react";
import { Github } from "@/components/icons/github-icon";
import { useRef, useState, type ComponentType } from "react";
import { BetaTag } from "@/components/beta-tag";
import { APP_VERSION, IS_BETA_BUILD } from "@/lib/build-info";
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
  { label: "Much worse", Icon: Angry, color: "#f04444" },
  { label: "Worse", Icon: Frown, color: "#f59e0b" },
  { label: "About the same", Icon: Meh, color: "#9aa3af" },
  { label: "Better", Icon: Smile, color: "#34d399" },
  { label: "Much better", Icon: Laugh, color: "#22c55e" },
];
const TRACK =
  "linear-gradient(to right, #f04444 0%, #f59e0b 27%, #9aa3af 50%, #34d399 73%, #22c55e 100%)";

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
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromX = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setValue(Math.round(x * (STOPS.length - 1)));
  };

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
    const body = `**Build:** ${APP_VERSION}${IS_BETA_BUILD ? " (beta)" : ""}\n**How it feels:** ${s.label}\n\n**What got worse, or what broke?**\n\n\n**Steps to make it happen (if any):**\n\n\n_A screenshot helps us a ton._`;
    void openUrl(
      `${REPO_ISSUE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=feedback`,
    );
  };

  if (committed != null) {
    const s = STOPS[committed];
    const negative = committed <= 1;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${s.color}26`, color: s.color }}
          >
            <s.Icon size={18} strokeWidth={2.1} />
          </span>
          <p className="flex-1 text-[14px] font-medium text-ink">
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
          <div className="flex flex-col items-start gap-2.5 rounded-lg border border-edge-soft bg-elevated/40 p-3.5">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {t(
                "Sorry this one is not better. Tell us what went wrong and we will fix it for you.",
              )}
            </p>
            <button
              type="button"
              onClick={() => openIssue(committed)}
              className="flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Github size={15} strokeWidth={2.2} />
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
    <div className="flex flex-col gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-4">
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
            {t("How is this build treating you?")}
            <BetaTag />
          </span>
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t("Does Harbor {version} feel better or worse than the version you had before?", {
              version: APP_VERSION,
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2.5 py-1" style={{ color: cur.color }}>
        <cur.Icon size={26} strokeWidth={2} />
        <span className="text-[18px] font-semibold tracking-tight">{t(cur.label)}</span>
      </div>

      <div className="flex items-center gap-3" dir="ltr">
        <span className="w-14 shrink-0 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("Worse")}
        </span>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t("Rate this build")}
          aria-valuemin={0}
          aria-valuemax={STOPS.length - 1}
          aria-valuenow={value}
          aria-valuetext={t(cur.label)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            setIsDragging(true);
            setFromX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging.current) setFromX(e.clientX);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            setIsDragging(false);
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              setValue((v) => Math.max(0, v - 1));
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              setValue((v) => Math.min(STOPS.length - 1, v + 1));
            }
          }}
          className="relative h-12 flex-1 cursor-pointer touch-none select-none outline-none"
        >
          <div
            className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full opacity-90 ring-1 ring-inset ring-black/10"
            style={{ backgroundImage: TRACK }}
          />
          {STOPS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55"
              style={{ left: `${(i / (STOPS.length - 1)) * 100}%` }}
            />
          ))}
          <span
            aria-hidden
            className={`absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-canvas shadow-[0_4px_14px_-2px_rgba(0,0,0,0.55)] ring-2 transition-all duration-150 ${
              isDragging ? "scale-110" : ""
            }`}
            style={
              {
                left: `${(value / (STOPS.length - 1)) * 100}%`,
                color: cur.color,
                "--tw-ring-color": cur.color,
              } as React.CSSProperties
            }
          >
            <cur.Icon size={19} strokeWidth={2.1} />
          </span>
        </div>
        <span className="w-14 shrink-0 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("Better")}
        </span>
      </div>

      <button
        type="button"
        onClick={commit}
        className="flex h-11 items-center justify-center gap-2 self-stretch rounded-xl bg-accent text-[14px] font-semibold text-[#1b1304] transition-[filter,transform] hover:brightness-105 active:scale-[0.99]"
      >
        {t("Send rating")}
      </button>
    </div>
  );
}
