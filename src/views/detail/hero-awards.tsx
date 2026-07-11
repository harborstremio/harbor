import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { useT } from "@/lib/i18n";
import { useLayoutEffect, useRef, useState } from "react";

type HeroTier = "full" | "compact" | "hidden";

export function HeroAwardsCorner({
  summary,
  inline,
  interactive = true,
  className,
}: {
  summary: { type: string; wins: number; nominations: number }[];
  inline?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLButtonElement | null>(null);
  const [tier, setTier] = useState<HeroTier>("full");
  useLayoutEffect(() => {
    if (inline) {
      setTier("full");
      return;
    }
    const host = ref.current?.offsetParent as HTMLElement | null;
    if (!host) return;
    const check = () => {
      const w = host.clientWidth;
      setTier(w >= 720 ? "full" : w >= 460 ? "compact" : "hidden");
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(host);
    return () => ro.disconnect();
  }, [inline]);

  const top = summary[0];
  if (!top || tier === "hidden") return null;
  const compact = tier === "compact";
  const nominationsLabel = (n: number) => (n === 1 ? t("nomination") : t("nominations"));
  const lines: string[] = [];
  for (const item of summary) {
    if (item.wins > 0) {
      const winPart = `${item.wins} ${awardNoun(item.type, item.wins)}`;
      lines.push(
        item.nominations > 0 ? `${winPart} · ${item.nominations} ${nominationsLabel(item.nominations)}` : winPart,
      );
    } else if (item.nominations > 0) {
      lines.push(`${item.nominations} ${awardNoun(item.type, item.nominations)} ${nominationsLabel(item.nominations)}`);
    }
  }
  if (lines.length === 0) return null;
  const won = top.wins > 0;
  const headline = compact
    ? won
      ? t("Award Winner")
      : t("Award Nominee")
    : `${headlineFor(top.type)} ${won ? t("Winner") : t("Nominee")}`;
  const laurelTint = laurelColorFor(top.type);
  const positionCls = className ?? (inline ? "max-w-md" : "absolute bottom-14 end-12 max-w-[44%]");
  const content = (
    <>
      <span
        className="shrink-0 text-accent transition-transform duration-200 group-hover:scale-105"
        style={laurelTint ? { color: laurelTint } : undefined}
      >
        {won ? (
          <Laurel size={compact ? 48 : 68}>
            <AwardLogo type={top.type} size={compact ? 18 : 24} />
          </Laurel>
        ) : (
          <span className="opacity-80">
            <AwardLogo type={top.type} size={compact ? 22 : 28} />
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className={`truncate font-semibold uppercase tracking-[0.18em] text-ink/55 ${compact ? "text-[9.5px]" : "text-[10.5px]"}`}
        >
          {headline}
        </span>
        {!compact && (
          <div className="flex flex-col gap-0.5 text-[13px] font-medium leading-snug text-ink/70">
            {lines.map((l) => (
              <span key={l} className="truncate">
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div className={`group flex items-center gap-3 rounded-2xl px-3 py-2 text-end ${positionCls}`}>{content}</div>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      data-hero-awards
      onClick={(e) => {
        e.stopPropagation();
        document.getElementById("awards-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2 text-end transition-all duration-200 hover:-translate-y-0.5 hover:bg-canvas/45 ${positionCls}`}
    >
      {content}
    </button>
  );
}

function awardNoun(type: string, n: number): string {
  const plural = n === 1 ? "" : "s";
  switch (type) {
    case "oscar":
      return `Oscar${plural}`;
    case "emmy":
      return `Emmy${n === 1 ? "" : "s"}`;
    case "bafta":
      return `BAFTA${plural}`;
    case "golden_globe":
      return `Golden Globe${plural}`;
    case "sag":
      return `SAG Award${plural}`;
    case "critics_choice":
      return `Critics' Choice Award${plural}`;
    case "cannes":
      return `Cannes Award${plural}`;
    case "venice":
      return `Venice Award${plural}`;
    case "berlin":
      return `Berlin Award${plural}`;
    default:
      return `Award${plural}`;
  }
}

function headlineFor(type: string): string {
  switch (type) {
    case "oscar":
      return "Academy Award";
    case "emmy":
      return "Primetime Emmy";
    case "bafta":
      return "BAFTA";
    case "golden_globe":
      return "Golden Globe";
    case "sag":
      return "SAG Award";
    case "cannes":
      return "Cannes";
    case "venice":
      return "Venice";
    case "berlin":
      return "Berlin";
    case "critics_choice":
      return "Critics' Choice";
    default:
      return "Award";
  }
}
