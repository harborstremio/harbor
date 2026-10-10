import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { usePosterChain } from "@/components/poster";

export function PortCard({
  meta,
  onClick,
  onHover,
  describedBy,
  index = 0,
  state = "heading",
}: {
  meta: Meta;
  onClick?: () => void;
  onHover?: (rect: DOMRect | null) => void;
  describedBy?: string;
  index?: number;
  state?: "heading" | "done" | "current";
}) {
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  const passive = state !== "heading";
  return (
    <button
      type="button"
      aria-describedby={describedBy}
      onClick={onClick}
      onMouseEnter={(e) => !passive && onHover?.(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => !passive && onHover?.(null)}
      onFocus={(e) => !passive && onHover?.(e.currentTarget.getBoundingClientRect())}
      onBlur={() => !passive && onHover?.(null)}
      style={{
        animationDelay: `${Math.min(index * 60, 480)}ms`,
        animationDuration: "420ms",
        animationFillMode: "both",
      }}
      className="group flex w-full flex-col gap-2.5 text-start [transform-origin:center_bottom] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 active:scale-[0.97]"
    >
      <span
        className={`relative block aspect-[2/3] overflow-hidden rounded-md ring-1 ring-edge-soft transition-[transform,box-shadow,border-color] duration-200 ease-out group-hover:will-change-transform ${
          passive
            ? "opacity-55"
            : "group-hover:-translate-y-1 group-hover:ring-edge group-hover:shadow-[0_26px_50px_-20px_rgba(0,0,0,0.7)] motion-reduce:group-hover:translate-y-0"
        }`}
      >
        <img
          src={poster.src}
          onError={poster.onError}
          alt=""
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-[520ms] ease-out [transition-delay:90ms] motion-safe:group-hover:will-change-transform motion-safe:group-hover:scale-[1.06] motion-reduce:transition-none"
        />
      </span>
      <span className="line-clamp-1 text-[12.5px] font-medium text-ink-muted transition-colors group-hover:text-ink">
        {meta.name}
      </span>
    </button>
  );
}
