import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ServiceLogo } from "@/components/service-logo";
import { SERVICES } from "@/lib/providers/streaming";
import { SFX } from "@/lib/sfx";
import type { StreamingService } from "@/lib/settings";
import { useBpT } from "./bp-i18n";
import { BpRowHeader, type BpRowLead } from "./bp-row-header";
import { useBpServicePosters } from "./use-bp-service-posters";
import { publishBpBandArt, type BpBandArt } from "./use-bp-sections";

const CARD_WIDTH = "clamp(150px, 12.4vw, 244px)";

const FILL =
  "bg-[color-mix(in_oklab,var(--svc)_var(--svc-a),var(--bp-panel))] data-[bp-focus=true]:bg-[color-mix(in_oklab,var(--svc)_var(--svc-a-on),var(--bp-panel))]";

const SHEEN =
  "linear-gradient(to bottom, color-mix(in oklab, var(--color-ink) 12%, transparent) 0%, transparent 46%, color-mix(in oklab, var(--bp-void) 55%, transparent) 100%)";

function rgbOf(hex: string): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  const n = Number.parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function tileStyle(s: StreamingService): CSSProperties {
  // apple and starz are the only white tints in SERVICES: at 62% their tile
  // paints white and the mark, which is force-inverted to white, disappears.
  const alpha = SERVICES[s].tint.toUpperCase() === "#FFFFFF" ? 18 : 62;
  return {
    width: CARD_WIDTH,
    aspectRatio: "1.2 / 1",
    "--svc": SERVICES[s].tint,
    "--svc-a": `${alpha}%`,
    "--svc-a-on": `${alpha + 18}%`,
  } as CSSProperties;
}

export function BpServiceRow({
  services,
  onOpen,
  lead,
}: {
  services: StreamingService[];
  onOpen: (s: StreamingService) => void;
  lead?: BpRowLead;
}) {
  const t = useBpT();
  const [focused, setFocused] = useState<StreamingService | null>(null);
  const posters = useBpServicePosters(focused);

  const recordFor = useCallback(
    (s: StreamingService): BpBandArt => ({
      key: `service:${s}`,
      tint: rgbOf(SERVICES[s].tint),
      posters: s === focused ? posters : undefined,
      logo: SERVICES[s].logo,
      // Several services ship no mark. The name is unused while the logo paints
      // and becomes the subject when it does not, so the band still says which
      // service you are on instead of falling back to the generic band title.
      title: SERVICES[s].name,
      logoScale: "subject",
    }),
    [focused, posters],
  );

  // The poster field resolves long after the focus that asked for it, so the
  // band has to be republished when it lands. Moving this into onFocus alone
  // leaves the mosaic permanently empty.
  useEffect(() => {
    if (focused) publishBpBandArt("services", recordFor(focused));
  }, [focused, recordFor]);

  if (services.length === 0) return null;

  const title = lead?.title ?? t("Your Streaming");

  return (
    <section
      data-bp-row
      data-bp-row-key="services"
      data-bp-row-tab={lead?.tab}
      aria-label={lead ? title : undefined}
      className="relative"
    >
      <BpRowHeader title={title} lead={lead} />
      <div
        data-bp-scroll-x
        onFocus={(e) => {
          const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-bp-service]");
          setFocused((cell?.dataset.bpService as StreamingService | undefined) ?? services[0]);
        }}
        className="flex gap-[clamp(11px,1vw,20px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {services.map((s) => (
          <button
            key={s}
            type="button"
            data-bp-focusable
            data-bp-tile
            data-bp-service={s}
            data-bp-restore-key={`service:${s}`}
            onClick={() => {
              SFX.click();
              onOpen(s);
            }}
            aria-label={SERVICES[s].name}
            className={`group relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] transition-[background-color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] ${FILL}`}
            style={tileStyle(s)}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: SHEEN }}
            />
            <span className="relative flex h-[40%] w-[72%] items-center justify-center text-center text-ink [&>img]:max-h-full [&>img]:max-w-full [&>img]:object-contain">
              <ServiceLogo service={s} height={80} onBrand />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
