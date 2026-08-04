import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SERVICES } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";
import { MobileServicePage } from "./mobile-service-page";

const FORCE_WHITE = "brightness(0) invert(1)";
const SERVICE_KEYS = Object.keys(SERVICES) as StreamingService[];

const SERVICES_MOTION_CSS = `
.harbor-services-enter {
  animation: harbor-services-enter 320ms var(--ease-out) both;
}
.harbor-services-swap {
  animation: harbor-services-swap 240ms var(--ease-out) both;
}
@keyframes harbor-services-enter {
  from { opacity: 0; transform: translate3d(0, 16px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes harbor-services-swap {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-services-enter, .harbor-services-swap { animation: none; }
}
`;

export function MobileServices({
  onBack,
  initialService,
}: {
  onBack: () => void;
  initialService?: StreamingService;
}) {
  const [selected, setSelected] = useState<StreamingService | null>(initialService ?? null);
  const [hasNavigated, setHasNavigated] = useState(false);

  if (selected) {
    return (
      <MobileServicePage
        key={selected}
        service={selected}
        onBack={() => {
          setHasNavigated(true);
          setSelected(null);
        }}
      />
    );
  }

  const viewAnim = hasNavigated ? "harbor-services-swap" : "harbor-services-enter";
  return (
    <div
      className={`flex flex-col gap-7 px-4 ${viewAnim}`}
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      <style>{SERVICES_MOTION_CSS}</style>
      <TopBar title="Services" onBack={onBack} />
      <div className="grid grid-cols-3 gap-3">
        {SERVICE_KEYS.map((svc) => (
          <ServiceCard
            key={svc}
            service={svc}
            onSelect={() => {
              setHasNavigated(true);
              setSelected(svc);
            }}
          />
        ))}
      </div>
      <div className="h-4" />
    </div>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-ms-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-transform active:scale-[0.96]"
      >
        <ChevronLeft size={24} strokeWidth={2.4} className="dir-icon" />
      </button>
      <h1 className="font-display text-[22px] font-medium text-ink">{title}</h1>
    </header>
  );
}

function ServiceCard({ service, onSelect }: { service: StreamingService; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  const meta = SERVICES[service];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={meta.name}
      className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-elevated/70 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-edge-soft/60 transition-transform active:scale-[0.96]"
    >
      {failed ? (
        <span className="px-1 text-center text-[13px] font-semibold tracking-tight text-ink">
          {meta.name}
        </span>
      ) : (
        <img
          src={meta.logo}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="max-h-[44%] max-w-[72%] object-contain"
          style={{ filter: FORCE_WHITE }}
        />
      )}
    </button>
  );
}
