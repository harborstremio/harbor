import { HarborMark } from "@/components/icons/harbor-mark";
import { useT } from "@/lib/i18n";

export function WelcomeStep() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-ink">
          <HarborMark className="h-12 w-12 shrink-0" />
          <span
            className="font-display text-[44px] font-medium leading-none tracking-tight"
            style={{ transform: "translateY(2px)" }}
          >
            Harb
            <span
              className="inline-block"
              style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
            >
              o
            </span>
            r
          </span>
        </div>
        <p className="text-[15.5px] leading-relaxed text-ink-muted">
          {t(
            "A client for the Stremio protocol. Two minutes to set up; most of it optional. You stay in control of every key.",
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <Bullet title={t("Current")}>
          {t("Trending, in theaters, what's on every streamer.")}
        </Bullet>
        <Bullet title={t("Yours")}>{t("Your Stremio library + addons sync in untouched.")}</Bullet>
        <Bullet title={t("Quiet")}>{t("No telemetry, no servers, no bundled keys.")}</Bullet>
      </div>
    </div>
  );
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-edge-soft bg-canvas/60 p-4">
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink">
        {title}
      </span>
      <span className="text-[12.5px] leading-snug text-ink-muted">{children}</span>
    </div>
  );
}
