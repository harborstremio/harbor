import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { goBigPictureTab } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { acceptSportsConsent, declineSportsConsent } from "@/lib/sports/consent";
import {
  SPORTS_POLICY_LINKS,
  SPORTS_USAGE_DETAILS,
  SPORTS_USAGE_SECTIONS,
  SPORTS_USAGE_SUMMARY,
} from "@/lib/sports/usage-notice";
import { useBpT } from "../bp-i18n";
import {
  BP_ROW_FLUSH,
  BpDecisionAction,
  BpDecisionNote,
  BpDecisionRow,
} from "../onboarding/bp-step-parts";
import { recoverBpFocus } from "../use-bp-focus";

const ACK =
  "I understand this notice and agree to use Sports only with sources and content I have permission to access.";

const PAGE =
  "flex h-full flex-col gap-[clamp(10px,1.4vh,22px)] px-[var(--bp-gutter)] pt-[var(--bp-page-top)] pb-[var(--bp-hint-h)]";

const READ =
  "flex h-full flex-col gap-[clamp(11px,1.5vh,24px)] overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const MEASURE = "max-w-[min(74ch,62vw)]";

const ROW = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 96px" } as const;

const EYEBROW =
  "text-[calc(clamp(10px,1.3vh,15px)*var(--bp-up,1))] font-bold uppercase tracking-[0.2em] text-ink-subtle";

const TITLE =
  "font-display text-[calc(clamp(26px,4.2vh,52px)*var(--bp-up,1))] font-semibold leading-[1.04] tracking-[-0.02em] text-ink";

const SUMMARY = "text-[calc(clamp(14px,1.95vh,24px)*var(--bp-up,1))] leading-[1.55] text-ink";

const PANEL =
  "flex flex-col gap-[clamp(5px,0.7vh,10px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(16px,1.5vw,30px)] py-[clamp(13px,1.7vh,26px)]";

const PANEL_TITLE =
  "text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-bold uppercase tracking-[0.14em] text-ink-subtle";

const PANEL_TEXT =
  "text-[calc(clamp(13px,1.8vh,21px)*var(--bp-up,1))] leading-[1.6] text-ink-muted";

const DETAIL = "text-[calc(clamp(12px,1.65vh,19px)*var(--bp-up,1))] leading-[1.6] text-ink-subtle";

const ACK_ROW =
  "flex w-full items-center gap-[clamp(12px,1.2vw,24px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] px-[clamp(15px,1.4vw,28px)] py-[clamp(11px,1.4vh,20px)] text-start text-[calc(clamp(13px,1.85vh,22px)*var(--bp-up,1))] font-semibold leading-[1.4] text-ink transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none";

function BpAckMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[clamp(30px,3.6vh,46px)] w-[clamp(30px,3.6vh,46px)] shrink-0 items-center justify-center rounded-[var(--bp-r-xs)] border-2 border-current ${
        on ? "" : "opacity-50"
      }`}
    >
      {on && <Check className="h-[62%] w-[62%]" strokeWidth={3} />}
    </span>
  );
}

export function BpSportsConsent() {
  const t = useBpT();
  const readRef = useRef<HTMLDivElement | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = readRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight - el.clientHeight > 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const page = () => {
    const el = readRef.current;
    if (!el) return;
    const end = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      top: end ? 0 : el.scrollTop + el.clientHeight * 0.8,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const accept = () => {
    acceptSportsConsent();
    window.requestAnimationFrame(() => {
      recoverBpFocus();
      window.setTimeout(() => recoverBpFocus(), 180);
    });
  };

  const decline = () => {
    declineSportsConsent();
    goBigPictureTab("live");
  };

  return (
    <div className={PAGE}>
      <div className={`${MEASURE} flex shrink-0 flex-col gap-[clamp(3px,0.5vh,8px)]`}>
        <span className={EYEBROW}>{t("Sports")}</span>
        <h1 className={TITLE}>{t("Before you open Sports")}</h1>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={readRef} className={READ}>
          <p className={`${MEASURE} ${SUMMARY}`}>{t(SPORTS_USAGE_SUMMARY)}</p>
          {SPORTS_USAGE_SECTIONS.map((section) => (
            <section key={section.title} className={`${MEASURE} ${PANEL}`}>
              <h2 className={PANEL_TITLE}>{t(section.title)}</h2>
              <p className={PANEL_TEXT}>{t(section.text)}</p>
            </section>
          ))}
          <section className={`${MEASURE} flex flex-col gap-[clamp(6px,0.9vh,13px)]`}>
            <h2 className={PANEL_TITLE}>{t("Services, privacy and source policies")}</h2>
            {SPORTS_USAGE_DETAILS.map((text) => (
              <p key={text} className={DETAIL}>
                {t(text)}
              </p>
            ))}
            <ul className="flex flex-col gap-[clamp(4px,0.6vh,9px)] pt-[clamp(3px,0.5vh,8px)]">
              {SPORTS_POLICY_LINKS.map((link) => (
                <li key={link.url} className="flex flex-col">
                  <span className="text-[calc(clamp(12px,1.6vh,18px)*var(--bp-up,1))] font-semibold text-ink">
                    {t(link.label)}
                  </span>
                  <span className="break-all text-[calc(clamp(10.5px,1.4vh,15px)*var(--bp-up,1))] font-medium text-ink-subtle">
                    {link.url}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        {overflows && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(28px,4vh,58px)]"
            style={{ background: "linear-gradient(to bottom, transparent, var(--bp-page))" }}
          />
        )}
      </div>

      {overflows && (
        <BpDecisionRow>
          <BpDecisionAction label={t("Read the rest")} tone="quiet" onSelect={page} />
        </BpDecisionRow>
      )}

      <div data-bp-row style={ROW} className={`${MEASURE} shrink-0`}>
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          data-bp-autofocus="true"
          aria-pressed={agreed}
          onClick={() => {
            SFX.click();
            setAgreed((on) => !on);
          }}
          className={ACK_ROW}
        >
          <BpAckMark on={agreed} />
          <span className="min-w-0 flex-1">{t(ACK)}</span>
        </button>
      </div>

      <BpDecisionRow>
        <BpDecisionAction label={t("Decline and hide Sports")} tone="quiet" onSelect={decline} />
        <BpDecisionAction label={t("Agree and open Sports")} disabled={!agreed} onSelect={accept} />
      </BpDecisionRow>

      <div className={MEASURE}>
        <BpDecisionNote
          text={t(
            "This choice applies to this device. You can hide Sports or show this notice again in Settings.",
          )}
        />
      </div>
    </div>
  );
}
