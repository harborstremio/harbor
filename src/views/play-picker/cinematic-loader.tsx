import type { Meta } from "@/lib/cinemeta";

import { LogoOrText } from "./logo-or-text";

export function CinematicLoader({ meta }: { meta: Meta }) {
  return (
    <div className="flex flex-col items-center gap-8 py-24">
      <LogoOrText
        logo={meta.logo ?? null}
        fallbackText={meta.name}
        imgClass="max-h-40 w-auto max-w-[70%] animate-loader-pulse object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        textClass="animate-loader-pulse font-display text-[72px] font-medium leading-[0.96] tracking-tight text-ink drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-ink-subtle">Searching streams</p>
    </div>
  );
}
