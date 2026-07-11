import { ServiceLogo } from "@/components/service-logo";
import { useT } from "@/lib/i18n";
import { SERVICES } from "@/lib/providers/streaming";
import { useSettings, type StreamingService } from "@/lib/settings";
import { Check } from "lucide-react";

export function StreamingStep() {
  const { settings, toggleStreaming } = useSettings();
  const t = useT();
  const tmdbReady = !!settings.tmdbKey;
  return (
    <div className="flex flex-col gap-6">
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 3 · Streaming")}
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
          {t("Pick what you actually use")}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Harbor pulls the most popular titles each service has right now. Toggle off anything you don't subscribe to.",
          )}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(SERVICES) as StreamingService[]).map((svc) => {
          const on = settings.streaming[svc];
          return (
            <button
              key={svc}
              onClick={() => toggleStreaming(svc)}
              aria-pressed={on}
              className={`relative flex h-16 items-center justify-center overflow-hidden rounded-xl border px-2 transition-all ${
                on
                  ? "border-ink-subtle/50 bg-raised opacity-100"
                  : "border-edge-soft bg-canvas opacity-55 hover:opacity-90"
              }`}
            >
              <ServiceLogo service={svc} height={22} />
              {on && (
                <span className="absolute end-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink">
                  <Check size={9} strokeWidth={3} className="text-canvas" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!tmdbReady && (
        <p className="text-[13px] text-ink-subtle">
          {t("These rails activate once a TMDB key is set. You can come back to this anytime in Settings.")}
        </p>
      )}
    </div>
  );
}
