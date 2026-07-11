import { useT } from "@/lib/i18n";
import type { WatchProvider } from "@/lib/providers/tmdb";
import { openUrl } from "@/lib/window";

export function WatchOn({ providers }: { providers: WatchProvider[] }) {
  const t = useT();
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{t("Watch on")}</p>
      <div className="flex flex-wrap gap-2.5">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => p.link && openUrl(p.link)}
            title={p.name}
            className="group flex h-11 items-center gap-2.5 rounded-xl border border-edge-soft bg-elevated/70 ps-2 pe-3.5 transition-[transform,background-color,border-color] duration-150 hover:border-ink-subtle hover:bg-elevated active:scale-[0.97]"
          >
            <img
              src={p.logo}
              alt={p.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-7 w-7 select-none rounded-md object-contain"
            />
            <span className="text-[13.5px] font-semibold tracking-tight text-ink">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
